export const dynamic = 'force-dynamic';
import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import type { JourneyEnrollment } from '@/lib/types/journey';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

interface CampaignMessage {
  messageId: string;
  campaignId: string;
  customerId: string;
  customerPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface WhatsAppWebhookEntry {
  id: string;
  payload: JsonRecord;
  receivedAt: string;
  status: 'processed' | 'skipped' | 'error';
  error?: string;
}

const MAX_CAMPAIGN_LOGS = 500;
const MAX_JOURNEY_LOGS = 500;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected webhook error';

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toJsonRecord = (value: unknown): JsonRecord => {
  if (isRecord(value)) return value;
  return {};
};

const toCampaignMessages = (): CampaignMessage[] => {
  return readJsonFile<CampaignMessage>('campaign-messages.json');
};

const toJourneyEnrollments = (): JourneyEnrollment[] => {
  return readJsonFile<JourneyEnrollment>('journey-enrollments.json');
};

function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return true;

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
  } catch (error) {
    console.error('[WhatsApp Webhook] Signature verification error:', error);
    return false;
  }
}

function logWebhook(entry: WhatsAppWebhookEntry) {
  try {
    const logs = readJsonFile<WhatsAppWebhookEntry>('whatsapp-webhooks.json');
    logs.unshift(entry);
    if (logs.length > MAX_JOURNEY_LOGS) {
      logs.length = MAX_JOURNEY_LOGS;
    }
    writeJsonFile('whatsapp-webhooks.json', logs);
  } catch (error) {
    console.error('[WhatsApp Webhook] Failed to persist webhook log:', error);
  }
}

function updateCampaignMessageStatus(
  messages: CampaignMessage[],
  statusUpdate: {
    messageId: string;
    status: CampaignMessage['status'];
    timestamp: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): CampaignMessage[] {
  const index = messages.findIndex(message => message.messageId === statusUpdate.messageId);
  if (index === -1) return messages;

  const existing = messages[index];
  const next: CampaignMessage = {
    ...existing,
    status: statusUpdate.status,
    deliveredAt:
      statusUpdate.status === 'delivered' || statusUpdate.status === 'read'
        ? statusUpdate.timestamp
        : existing.deliveredAt,
    readAt: statusUpdate.status === 'read' ? statusUpdate.timestamp : existing.readAt,
    failedAt: statusUpdate.status === 'failed' ? statusUpdate.timestamp : existing.failedAt,
    errorCode: statusUpdate.status === 'failed' ? statusUpdate.errorCode ?? null : existing.errorCode,
    errorMessage: statusUpdate.status === 'failed' ? statusUpdate.errorMessage ?? null : existing.errorMessage,
  };

  const nextMessages = [...messages];
  nextMessages[index] = next;
  return nextMessages;
}

function appendJourneyAction(enrollments: JourneyEnrollment[], messageId: string): JourneyEnrollment[] {
  const updated = [...enrollments];
  for (let index = 0; index < updated.length; index += 1) {
    const enrollment = updated[index];
    const action = enrollment.actions?.find(
      item => item.type === 'message_sent' && item.metadata?.messageId === messageId,
    );

    if (action) {
      const actions = enrollment.actions ?? [];
      actions.push({
        type: 'message_opened',
        at: Date.now(),
        metadata: { messageId, originalAction: action.metadata ?? {} },
      });
      updated[index] = {
        ...enrollment,
        actions,
        updatedAt: Date.now(),
      };
      break;
    }
  }
  return updated;
}

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString();
  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-hub-signature-256')?.replace('sha256=', '') || null;
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET ?? '';

    if (webhookSecret && !verifyWebhookSignature(bodyText, signature, webhookSecret)) {
      logWebhook({
        id: `webhook_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        payload: {},
        receivedAt,
        status: 'error',
        error: 'Invalid signature',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = toJsonRecord(JSON.parse(bodyText));

    logWebhook({
      id: `webhook_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      payload,
      receivedAt,
      status: 'processed',
    });

    if (payload.object === 'whatsapp_business_account') {
      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      for (const entry of entries) {
        const entryRecord = toJsonRecord(entry);
        const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];
        for (const change of changes) {
          const changeRecord = toJsonRecord(change);
          const value = toJsonRecord(changeRecord.value);

          const statuses = Array.isArray(value.statuses) ? value.statuses : [];
          if (statuses.length > 0) {
            let campaignMessages = toCampaignMessages();
            let enrollments = toJourneyEnrollments();

            statuses.forEach(status => {
              const statusRecord = toJsonRecord(status);
              const messageId = toTrimmedString(statusRecord.id);
              const statusType = toTrimmedString(statusRecord.status) as CampaignMessage['status'] | undefined;
              const timestamp =
                typeof statusRecord.timestamp === 'string'
                  ? new Date(Number.parseInt(statusRecord.timestamp, 10) * 1000).toISOString()
                  : receivedAt;
              const err = Array.isArray(statusRecord.errors) ? statusRecord.errors[0] : undefined;
              const errorCode = toTrimmedString((err as any)?.code);
              const errorMessage = toTrimmedString((err as any)?.title);

              if (!messageId || !statusType) return;

              campaignMessages = updateCampaignMessageStatus(campaignMessages, {
                messageId,
                status: statusType,
                timestamp,
                errorCode,
                errorMessage,
              });

              if (statusType === 'read') {
                enrollments = appendJourneyAction(enrollments, messageId);
              }
            });

            writeJsonFile('campaign-messages.json', campaignMessages.slice(0, MAX_CAMPAIGN_LOGS));
            writeJsonFile('journey-enrollments.json', enrollments);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '');
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

