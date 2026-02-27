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

  // ─── Campaign conversion attribution (orders/create) ────────
  try {
    if (topic === 'orders/create') {
      attributeOrderToCampaign(payload).catch(err => {
        console.error('[webhooks][shopify] Campaign attribution failed:', err);
      });
    }
  } catch (error) {
    console.error('[webhooks][shopify] Campaign attribution error:', error);
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

/**
 * Campaign conversion attribution (72-hour attribution window, last-touch)
 * When a Shopify order is created, check if the customer received a campaign
 * message within the last 72 hours and attribute the conversion.
 */
async function attributeOrderToCampaign(payload: JsonRecord): Promise<void> {
  try {
    const customerEmail = (payload.email as string) || (payload.customer as JsonRecord)?.email as string || '';
    const customerPhone = (payload.customer as JsonRecord)?.phone as string ||
      (payload.billing_address as JsonRecord)?.phone as string || '';
    const orderTotal = Number(payload.total_price || 0);
    const orderId = String(payload.id || '');

    if ((!customerEmail && !customerPhone) || !orderId) return;

    // Normalize phone for matching — campaigns store Shopify customer IDs,
    // but we can match via phone or email in the customerId field
    const searchTerms: string[] = [];
    if (customerEmail) searchTerms.push(customerEmail);
    if (customerPhone) {
      // Strip non-digits for flexible matching
      const digits = customerPhone.replace(/[\s\-+()]/g, '');
      if (digits) searchTerms.push(digits);
    }

    // Also try Shopify customer ID if available
    const shopifyCustomerId = (payload.customer as JsonRecord)?.id;
    if (shopifyCustomerId) searchTerms.push(String(shopifyCustomerId));

    // 72-hour attribution window
    const attributionCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Find recent campaign logs for this customer (last-touch attribution)
    for (const term of searchTerms) {
      const recentLog = await prisma.campaignLog.findFirst({
        where: {
          customerId: { contains: term },
          status: { in: ['SUCCESS', 'DELIVERED', 'READ', 'CLICKED'] },
          createdAt: { gte: attributionCutoff },
          convertedAt: null, // Not already attributed
        },
        orderBy: { createdAt: 'desc' }, // Last-touch
      });

      if (recentLog) {
        await prisma.campaignLog.update({
          where: { id: recentLog.id },
          data: {
            status: 'CONVERTED',
            convertedAt: new Date(),
            convertedOrderId: orderId,
            convertedAmount: orderTotal,
          },
        });

        await prisma.campaign.update({
          where: { id: recentLog.campaignId },
          data: {
            totalConverted: { increment: 1 },
            totalRevenue: { increment: orderTotal },
          },
        });

        console.log(`[Campaign Attribution] Order ${orderId} attributed to campaign ${recentLog.campaignId} (₹${orderTotal})`);
        return; // Only attribute once (last-touch)
      }
    }
  } catch (error) {
    console.error('[Campaign Attribution] Error:', error);
  }
}

