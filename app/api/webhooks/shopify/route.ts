export const dynamic = 'force-dynamic';
import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

interface ShopifyWebhookLogEntry {
  id: string;
  topic: string;
  shop?: string | null;
  receivedAt: string;
  payload: JsonRecord;
}

const SUPPORTED_TOPICS = new Set([
  'orders/create',
  'orders/fulfilled',
  'orders/cancelled',
  'checkouts/create',
  'customers/create',
  'customers/update',
]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function verifyShopifySignature(secret: string | undefined, rawBody: string, hmacHeader: string | null): boolean {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function normaliseTopic(topic: string | null): string {
  return (topic ?? '').toLowerCase();
}

function toJsonRecord(payload: unknown): JsonRecord {
  if (isRecord(payload)) {
    return payload;
  }
  return {};
}

function createLogEntry(topic: string, shop: string | null, payload: JsonRecord): ShopifyWebhookLogEntry {
  const timestamp = new Date().toISOString();
  return {
    id: `log_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    topic,
    shop,
    receivedAt: timestamp,
    payload,
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topicHeader = request.headers.get('x-shopify-topic');
  const shopHeader = request.headers.get('x-shopify-shop-domain');

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const isValid = verifyShopifySignature(secret, rawBody, hmacHeader);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const topic = normaliseTopic(topicHeader);
  if (!SUPPORTED_TOPICS.has(topic)) {
    return NextResponse.json({ acknowledged: true, unsupportedTopic: topic }, { status: 200 });
  }

  let payload: JsonRecord;
  try {
    payload = rawBody ? toJsonRecord(JSON.parse(rawBody)) : {};
  } catch (error) {
    console.error('[webhooks][shopify] Failed to parse webhook payload:', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const logs = readJsonFile<ShopifyWebhookLogEntry>('webhook-logs.json');
    logs.unshift(createLogEntry(topic, shopHeader, payload));
    const MAX_LOGS = 200;
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS;
    }
    writeJsonFile('webhook-logs.json', logs);
  } catch (error) {
    console.error('[webhooks][shopify] Failed to write webhook log:', error);
  }

  try {
    await matchAndExecuteJourneys(topic, {
      shop: shopHeader,
      payload,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[webhooks][shopify] Journey execution failed:', error);
  }

  // Queue segment re-evaluation for customer/order events
  try {
    if (topic === 'customers/create' || topic === 'customers/update' || topic === 'orders/create') {
      // Queue segment re-evaluation (non-blocking)
      queueSegmentReevaluation(topic, payload).catch(err => {
        console.error('[webhooks][shopify] Segment re-evaluation queued failed:', err);
      });
    }
  } catch (error) {
    console.error('[webhooks][shopify] Failed to queue segment re-evaluation:', error);
  }

  return NextResponse.json({ acknowledged: true });
}

/**
 * Queue segment re-evaluation (non-blocking)
 */
async function queueSegmentReevaluation(topic: string, payload: any): Promise<void> {
  // For now, we'll trigger a sync for affected segments
  // In production, this could use a proper job queue (Bull, Agenda, etc.)
  
  try {
    const { readJsonFile } = await import('@/lib/utils/json-storage');
    const segments = readJsonFile<any>('segments.json');
    
    // Only re-evaluate dynamic segments (not custom)
    const dynamicSegments = segments.filter((s: any) => s.type !== 'custom');
    
    if (dynamicSegments.length === 0) {
      return;
    }

    // Mark segments as needing update in database
    // The background job will pick this up
    try {
      await prisma.segmentSyncStatus.upsert({
        where: { id: 'singleton' },
        update: {
          needsUpdate: true,
          lastTriggered: new Date(),
          triggerTopic: topic,
        },
        create: {
          id: 'singleton',
          needsUpdate: true,
          lastTriggered: new Date(),
          triggerTopic: topic,
        },
      });
    } catch (error) {
      // Ignore errors in non-critical path
      console.warn('Could not update segment sync status:', error);
    }
  } catch (error) {
    console.error('Error queuing segment re-evaluation:', error);
  }
}

