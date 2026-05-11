export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Resend webhook handler.
 *
 * Wire this up at https://resend.com/webhooks with the URL
 *   https://<your-render-domain>/api/email/webhooks/resend
 * Resend signs requests using Svix (svix-id, svix-timestamp, svix-signature).
 * Paste the webhook signing secret into your env as RESEND_WEBHOOK_SECRET
 * (starts with "whsec_") to enable verification. If unset, the route still
 * works but skips verification — only safe behind a private network.
 */

const SVIX_TOLERANCE_SECONDS = 5 * 60; // reject events older than 5 min

function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  secret: string,
): boolean {
  // Reject stale timestamps
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SVIX_TOLERANCE_SECONDS) {
    return false;
  }

  // Strip the "whsec_" prefix if present, then base64-decode the secret
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretKey, 'base64');
  } catch {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(toSign).digest('base64');

  // Header looks like "v1,<sig1> v1,<sig2>" — any match passes
  for (const part of svixSignatureHeader.split(' ')) {
    const [, sig] = part.split(',');
    if (!sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'
  | 'email.failed';

interface ResendEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { complaintFeedbackType?: string };
    tags?: Record<string, string>;
  };
}

function eventTypeToEnum(
  type: ResendEventType,
): 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED' | null {
  switch (type) {
    case 'email.sent':
      return 'SENT';
    case 'email.delivered':
      return 'DELIVERED';
    case 'email.opened':
      return 'OPENED';
    case 'email.clicked':
      return 'CLICKED';
    case 'email.bounced':
      return 'BOUNCED';
    case 'email.complained':
      return 'COMPLAINED';
    case 'email.failed':
      return 'FAILED';
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
    }
    if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = eventTypeToEnum(event.type);
  if (!eventType) {
    // delivery_delayed and others we don't track yet — return OK so Resend doesn't retry
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const emailId = event.data.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, skipped: 'no email_id' });
  }

  try {
    const send = await prisma.emailCampaignSend.findUnique({
      where: { resendEmailId: emailId },
    });

    if (!send) {
      // Could be a transactional send (e.g. back-in-stock alert that doesn't go through a Campaign).
      // We still record it as an event keyed by resendEmailId so future joins can find it.
      const tags = event.data.tags ?? {};
      await prisma.emailEvent.create({
        data: {
          storeId: tags.store_id ?? '__unknown__',
          campaignId: tags.campaign_id ?? null,
          resendEmailId: emailId,
          email: (event.data.to ?? [])[0] ?? '',
          type: eventType,
          payload: event as any,
          url: event.data.click?.link ?? null,
          userAgent: event.data.click?.userAgent ?? null,
          ipAddress: event.data.click?.ipAddress ?? null,
          occurredAt: new Date(event.created_at),
        },
      });
      return NextResponse.json({ ok: true, orphan: true });
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: send.campaignId },
      select: { id: true, storeId: true },
    });
    if (!campaign) {
      return NextResponse.json({ ok: true, skipped: 'campaign deleted' });
    }

    const occurredAt = new Date(event.created_at);
    const eventCreate = prisma.emailEvent.create({
      data: {
        storeId: campaign.storeId,
        campaignId: campaign.id,
        campaignSendId: send.id,
        subscriberId: send.subscriberId,
        resendEmailId: emailId,
        email: send.email,
        type: eventType,
        payload: event as any,
        url: event.data.click?.link ?? null,
        userAgent: event.data.click?.userAgent ?? null,
        ipAddress: event.data.click?.ipAddress ?? null,
        occurredAt,
      },
    });

    // Update send + campaign counts. Use a single transaction so we don't
    // double-count if Resend retries.
    const sendUpdate: Record<string, unknown> = {};
    const campaignUpdate: Record<string, unknown> = {};

    switch (eventType) {
      case 'DELIVERED':
        if (!send.deliveredAt) {
          sendUpdate.status = 'DELIVERED';
          sendUpdate.deliveredAt = occurredAt;
          campaignUpdate.deliveredCount = { increment: 1 };
        }
        break;
      case 'OPENED':
        if (!send.openedAt) {
          sendUpdate.status = 'OPENED';
          sendUpdate.openedAt = occurredAt;
          campaignUpdate.openedCount = { increment: 1 };
        }
        break;
      case 'CLICKED':
        if (!send.clickedAt) {
          sendUpdate.status = 'CLICKED';
          sendUpdate.clickedAt = occurredAt;
          campaignUpdate.clickedCount = { increment: 1 };
        }
        break;
      case 'BOUNCED':
        if (!send.bouncedAt) {
          sendUpdate.status = 'BOUNCED';
          sendUpdate.bouncedAt = occurredAt;
          sendUpdate.errorMessage = event.data.bounce?.message ?? null;
          campaignUpdate.bouncedCount = { increment: 1 };
          // Hard bounce → mark subscriber as BOUNCED so future campaigns skip them
          if (send.subscriberId && event.data.bounce?.type === 'permanent') {
            await prisma.emailSubscriber.update({
              where: { id: send.subscriberId },
              data: {
                status: 'BOUNCED',
                suppressionReason: event.data.bounce?.message ?? 'Hard bounce',
              },
            });
          }
        }
        break;
      case 'COMPLAINED':
        if (!send.complainedAt) {
          sendUpdate.status = 'COMPLAINED';
          sendUpdate.complainedAt = occurredAt;
          campaignUpdate.complainedCount = { increment: 1 };
          if (send.subscriberId) {
            await prisma.emailSubscriber.update({
              where: { id: send.subscriberId },
              data: {
                status: 'COMPLAINED',
                suppressionReason: 'Spam complaint',
                unsubscribedAt: occurredAt,
              },
            });
          }
        }
        break;
      case 'FAILED':
        sendUpdate.status = 'FAILED';
        sendUpdate.errorMessage = event.data.bounce?.message ?? 'Send failed';
        campaignUpdate.failedCount = { increment: 1 };
        break;
      case 'SENT':
        // Already recorded at send time; just write the event row
        break;
    }

    await prisma.$transaction([
      eventCreate,
      ...(Object.keys(sendUpdate).length
        ? [prisma.emailCampaignSend.update({ where: { id: send.id }, data: sendUpdate })]
        : []),
      ...(Object.keys(campaignUpdate).length
        ? [prisma.emailCampaign.update({ where: { id: campaign.id }, data: campaignUpdate })]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Resend webhook] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
