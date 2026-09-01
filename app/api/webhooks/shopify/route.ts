export const dynamic = 'force-dynamic';
import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

const SUPPORTED_TOPICS = new Set([
  'orders/create',
  'orders/paid',
  'orders/fulfilled',
  'orders/partially_fulfilled',
  'orders/cancelled',
  'orders/updated',
  'orders/edited',
  'draft_orders/create',
  'fulfillments/create',
  'fulfillments/update',
  'refunds/create',
  'checkouts/create',
  'checkouts/update',
  'customers/create',
  'customers/update',
  'customers/enable',
  'app/uninstalled',
  'app_subscriptions/update',
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topicHeader = request.headers.get('x-shopify-topic');
  const shopHeader = request.headers.get('x-shopify-shop-domain');

  const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET;
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

  // ─── Campaign conversion attribution (orders/create) ────────
  try {
    if (topic === 'orders/create') {
      await attributeOrderToCampaign(payload, shopHeader);
    }
  } catch (error) {
    console.error('[webhooks][shopify] Campaign attribution error:', error);
  }

  // Send real utility WhatsApp notifications for Shopify order/shipping events.
  // Missing templates or customer phone numbers are logged, not simulated.
  try {
    if (
      topic === 'orders/create' ||
      topic === 'orders/fulfilled' ||
      topic === 'orders/partially_fulfilled' ||
      topic === 'orders/cancelled' ||
      topic === 'fulfillments/create' ||
      topic === 'fulfillments/update'
    ) {
      const { sendShopifyWhatsAppNotification } = await import('@/lib/whatsapp/shopify-notifications');
      await sendShopifyWhatsAppNotification(topic, payload, shopHeader);
    }
  } catch (error) {
    console.error('[webhooks][shopify] WhatsApp notification error:', error);
  }

  // ─── Handle app/uninstalled ─────────────────────────────────
  if (topic === 'app/uninstalled' && shopHeader) {
    try {
      await prisma.store.updateMany({
        where: { shopifyDomain: shopHeader },
        data: { isActive: false },
      });
      console.log(`[webhooks][shopify] app/uninstalled: deactivated store ${shopHeader}`);
    } catch (err) {
      console.error('[webhooks][shopify] app/uninstalled handler failed:', err);
    }
  }

  // ─── Handle app_subscriptions/update (Shopify Billing) ──────
  if (topic === 'app_subscriptions/update') {
    try {
      const appSubscription = payload.app_subscription as JsonRecord | undefined;
      if (appSubscription) {
        const gid = appSubscription.admin_graphql_api_id as string;
        const status = (appSubscription.status as string || '').toUpperCase();

        if (gid) {
          const { mapShopifyStatus } = await import('@/lib/shopify-billing');
          const mappedStatus = mapShopifyStatus(status);

          const updated = await prisma.subscription.updateMany({
            where: { shopifyChargeId: gid },
            data: { status: mappedStatus },
          });

          // No row matched the GID (e.g. the confirm redirect never completed).
          // Reconcile against Shopify (source of truth) so the merchant's real
          // plan, period end and charge are recorded — no hardcoded fallbacks.
          if (updated.count === 0 && mappedStatus === 'ACTIVE' && shopHeader) {
            const store = await prisma.store.findFirst({
              where: { shopifyDomain: shopHeader },
              select: { id: true },
            });
            if (store) {
              const { reconcileShopifySubscription } = await import('@/lib/billing-sync');
              await reconcileShopifySubscription(store.id);
              console.log(`[webhooks][shopify] app_subscriptions/update: reconciled subscription for ${shopHeader} (${gid})`);
            }
          }

          console.log(`[webhooks][shopify] app_subscriptions/update: ${gid} → ${mappedStatus} (${updated.count} records)`);
        }
      }
    } catch (err) {
      console.error('[webhooks][shopify] app_subscriptions/update handler failed:', err);
    }
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
async function attributeOrderToCampaign(payload: JsonRecord, shopDomain: string | null): Promise<void> {
  try {
    const customerEmail = (payload.email as string) || (payload.customer as JsonRecord)?.email as string || '';
    const customerPhone = (payload.customer as JsonRecord)?.phone as string ||
      (payload.billing_address as JsonRecord)?.phone as string || '';
    const orderTotal = Number(payload.total_price || 0);
    const orderId = String(payload.id || '');

    if ((!customerEmail && !customerPhone) || !orderId || !shopDomain || !Number.isFinite(orderTotal)) return;

    const store = await prisma.store.findUnique({
      where: { shopifyDomain: shopDomain },
      select: { id: true },
    });
    if (!store) return;

    const attributionUrls = [payload.landing_site, payload.landing_site_ref, payload.referring_site]
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    let campaignId = '';
    for (const candidate of attributionUrls) {
      try {
        const url = new URL(candidate, `https://${shopDomain}`);
        if (url.searchParams.get('utm_source')?.toLowerCase() === 'dorza') {
          campaignId = url.searchParams.get('dza_campaign_id') ?? '';
        }
      } catch {
        // Ignore malformed URLs supplied by Shopify.
      }
      if (campaignId) break;
    }
    if (!campaignId) return;

    const alreadyAttributed = await prisma.campaignLog.findFirst({
      where: { convertedOrderId: orderId, campaign: { storeId: store.id } },
      select: { id: true },
    });
    if (alreadyAttributed) return;

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
          campaignId,
          campaign: { storeId: store.id },
          customerId: { contains: term },
          status: 'CLICKED',
          clickedAt: { gte: attributionCutoff },
          convertedAt: null, // Not already attributed
        },
        orderBy: { clickedAt: 'desc' }, // Verified last-touch
      });

      if (recentLog) {
        await prisma.campaignLog.update({
          where: { id: recentLog.id },
          data: {
            status: 'CONVERTED',
            convertedAt: new Date(),
            convertedOrderId: orderId,
            convertedAmount: orderTotal,
            metadata: {
              ...(isRecord(recentLog.metadata) ? recentLog.metadata : {}),
              attribution: {
                verified: true,
                source: 'dorza_utm',
                shopDomain,
                campaignId,
              },
            },
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

