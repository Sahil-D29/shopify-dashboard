/**
 * Email campaign send pipeline.
 *
 * Two entry points:
 *  - sendCampaignNow(campaignId): used for immediate sends. Runs the full
 *    pipeline inline; safe for small audiences (<5k) where the request
 *    can complete in a single API invocation.
 *  - processScheduledCampaigns(): called by the cron handler. Promotes
 *    SCHEDULED campaigns whose scheduledAt has passed to SENDING and runs
 *    them.
 *
 * Sending uses Resend's batch endpoint (up to 100 emails per call). Each
 * recipient gets a personalized render via merge tags (first_name,
 * last_name, email, shop_name, unsubscribe_url, current_year).
 *
 * After all sends finish, the campaign is set to COMPLETED with final
 * counts. Per-recipient delivery, open, click, bounce, complaint events
 * arrive later via the Resend webhook → /api/email/webhooks/resend.
 */

import { prisma } from '@/lib/prisma';
import {
  isResendConfigured,
  ResendApiError,
  sendBatchEmails,
  type SendEmailPayload,
} from '@/lib/email/resend';

const BATCH_SIZE = 100; // Resend's batch endpoint limit

export interface SendCampaignResult {
  campaignId: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  durationMs: number;
}

function personalize(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function loadAudienceEmails(
  storeId: string,
  campaign: { audienceMode: string; segmentIds: string[] },
): Promise<Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>> {
  if (campaign.audienceMode === 'SEGMENTS' && campaign.segmentIds.length > 0) {
    // For now, segments use Shopify-based filters at calculation time; we don't
    // store a static membership table. To send to a segment we load all
    // SUBSCRIBED subscribers in the store and the campaign sends to all of
    // them — segment-aware filtering will be added once segment membership
    // is materialised. (Tracked as a follow-up.)
    return prisma.emailSubscriber.findMany({
      where: { storeId, status: 'SUBSCRIBED' },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }
  return prisma.emailSubscriber.findMany({
    where: { storeId, status: 'SUBSCRIBED' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}

export async function sendCampaignNow(campaignId: string): Promise<SendCampaignResult> {
  const start = Date.now();

  if (!isResendConfigured()) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
    throw new Error(
      'Resend is not configured. Set RESEND_API_KEY in environment variables.',
    );
  }

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { store: { select: { storeName: true, shopifyDomain: true } } },
  });
  if (!campaign) throw new Error('Campaign not found');

  if (
    campaign.status !== 'DRAFT' &&
    campaign.status !== 'SCHEDULED' &&
    campaign.status !== 'SENDING'
  ) {
    throw new Error(`Campaign is in status ${campaign.status} and cannot be sent`);
  }

  // Move to SENDING
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
  });

  let sentCount = 0;
  let failedCount = 0;

  try {
    const audience = await loadAudienceEmails(campaign.storeId, campaign);

    if (audience.length === 0) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          totalRecipients: 0,
        },
      });
      return {
        campaignId,
        status: 'COMPLETED',
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        durationMs: Date.now() - start,
      };
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { totalRecipients: audience.length },
    });

    const fromAddress = `${campaign.fromName} <${campaign.fromEmail}>`;
    const variantBSubject = campaign.abTestVariantSubject;

    // For A/B tests, split audience: abTestPercent goes to variant B, the rest to A.
    // For non-AB campaigns, everyone gets variant A.
    const usingAB = campaign.abTestEnabled && variantBSubject;
    const variantBCutoff = usingAB
      ? Math.floor(audience.length * (campaign.abTestPercent / 100))
      : 0;

    for (let start = 0; start < audience.length; start += BATCH_SIZE) {
      const slice = audience.slice(start, start + BATCH_SIZE);
      const payloads: SendEmailPayload[] = [];
      const tracking: Array<{ subscriberId: string; email: string; variant: 'A' | 'B' }> = [];

      slice.forEach((sub, idx) => {
        const absoluteIndex = start + idx;
        const variant: 'A' | 'B' = usingAB && absoluteIndex < variantBCutoff ? 'B' : 'A';
        const subject = variant === 'B' ? (variantBSubject as string) : campaign.subject;
        const mergeVars: Record<string, string> = {
          first_name: sub.firstName ?? 'there',
          last_name: sub.lastName ?? '',
          email: sub.email,
          shop_name: campaign.store?.storeName ?? '',
          shop_url: campaign.store?.shopifyDomain
            ? `https://${campaign.store.shopifyDomain}`
            : '',
          unsubscribe_url: '#', // wired up properly once unsubscribe page exists
          current_year: String(new Date().getFullYear()),
        };

        payloads.push({
          from: fromAddress,
          to: sub.email,
          subject: personalize(subject, mergeVars),
          html: personalize(campaign.htmlBody, mergeVars),
          reply_to: campaign.replyTo || undefined,
          headers: campaign.preheaderText
            ? { 'X-Preheader': campaign.preheaderText }
            : undefined,
          tags: [
            { name: 'campaign_id', value: campaignId },
            { name: 'variant', value: variant },
            { name: 'store_id', value: campaign.storeId },
          ],
        });
        tracking.push({ subscriberId: sub.id, email: sub.email, variant });
      });

      try {
        const result = await sendBatchEmails(payloads);
        const now = new Date();
        const items = Array.isArray(result.data) ? result.data : [];
        // Persist each send. Resend returns IDs in the same order as the input batch.
        await Promise.all(
          tracking.map((t, idx) => {
            const resendId = items[idx]?.id;
            return prisma.emailCampaignSend.upsert({
              where: { campaignId_email: { campaignId, email: t.email } },
              create: {
                campaignId,
                subscriberId: t.subscriberId,
                email: t.email,
                variant: t.variant,
                resendEmailId: resendId,
                status: resendId ? 'SENT' : 'FAILED',
                sentAt: resendId ? now : null,
                errorMessage: resendId ? null : 'No id returned from Resend',
              },
              update: {
                resendEmailId: resendId,
                status: resendId ? 'SENT' : 'FAILED',
                sentAt: resendId ? now : null,
                variant: t.variant,
              },
            });
          }),
        );
        sentCount += items.length;
        failedCount += tracking.length - items.length;
      } catch (error) {
        const message =
          error instanceof ResendApiError ? error.message : (error as Error).message;
        // Mark all sends in this batch as failed
        await Promise.all(
          tracking.map(t =>
            prisma.emailCampaignSend.upsert({
              where: { campaignId_email: { campaignId, email: t.email } },
              create: {
                campaignId,
                subscriberId: t.subscriberId,
                email: t.email,
                variant: t.variant,
                status: 'FAILED',
                errorMessage: message,
              },
              update: {
                status: 'FAILED',
                errorMessage: message,
              },
            }),
          ),
        );
        failedCount += tracking.length;
        console.error('[sendCampaignNow] Batch failed:', message);
      }
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    });

    return {
      campaignId,
      status: 'COMPLETED',
      totalRecipients: audience.length,
      sentCount,
      failedCount,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        sentCount,
        failedCount,
      },
    });
    throw error;
  }
}

export async function processScheduledCampaigns(): Promise<{
  processed: number;
  results: SendCampaignResult[];
  errors: Array<{ campaignId: string; error: string }>;
}> {
  const now = new Date();
  const due = await prisma.emailCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    select: { id: true },
    take: 5, // process up to 5 due campaigns per tick to keep cron under 60s
  });

  const results: SendCampaignResult[] = [];
  const errors: Array<{ campaignId: string; error: string }> = [];

  for (const { id } of due) {
    try {
      const result = await sendCampaignNow(id);
      results.push(result);
    } catch (error) {
      errors.push({
        campaignId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed: due.length, results, errors };
}

export async function sendTestEmail(
  campaignId: string,
  recipientEmail: string,
): Promise<{ id: string }> {
  if (!isResendConfigured()) {
    throw new Error('Resend is not configured');
  }
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { store: { select: { storeName: true, shopifyDomain: true } } },
  });
  if (!campaign) throw new Error('Campaign not found');

  const { sendEmail } = await import('@/lib/email/resend');
  const mergeVars: Record<string, string> = {
    first_name: 'Test',
    last_name: 'User',
    email: recipientEmail,
    shop_name: campaign.store?.storeName ?? '',
    shop_url: campaign.store?.shopifyDomain
      ? `https://${campaign.store.shopifyDomain}`
      : '',
    unsubscribe_url: '#',
    current_year: String(new Date().getFullYear()),
  };

  return sendEmail({
    from: `${campaign.fromName} <${campaign.fromEmail}>`,
    to: recipientEmail,
    subject: `[TEST] ${personalize(campaign.subject, mergeVars)}`,
    html: personalize(campaign.htmlBody, mergeVars),
    reply_to: campaign.replyTo || undefined,
    tags: [
      { name: 'campaign_id', value: campaignId },
      { name: 'test', value: 'true' },
    ],
  });
}
