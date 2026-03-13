import type { SegmentGroup } from '@/lib/types/segment';
import type { ShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { ShopifyOrder } from '@/lib/types/shopify-order';
import {
  matchesGroups,
  needsOrderEnrichment,
  needsEngagementEnrichment,
  needsAbandonedCheckoutEnrichment,
  needsRFMEnrichment,
  needsStorefrontEnrichment,
  type CustomerEnrichment,
  type CampaignLogEnrichment,
  type AbandonedCheckoutEnrichment,
  type StorefrontEventEnrichment,
} from '@/lib/segments/evaluator';
import { calculateRFMScores } from '@/lib/segments/rfm';

export interface SegmentStatsOptions {
  client: ShopifyClient;
  segmentId?: string;
  conditionGroups?: SegmentGroup[];
  cacheKey?: string;
  forceRefresh?: boolean;
  sampleLimit?: number;
  customers?: ShopifyCustomer[];
  storeId?: string;
}

export interface SegmentStats {
  customerCount: number;
  totalValue: number;
  totalOrders: number;
  avgOrderValue: number;
  lastUpdated: number;
  customers?: ShopifyCustomer[];
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

type CachedEntry = {
  stats: SegmentStats;
  timestamp: number;
};

const statsCache = new Map<string, CachedEntry>();

function getCacheKey(options: SegmentStatsOptions): string {
  if (options.cacheKey) return options.cacheKey;
  if (options.segmentId) return `segment:${options.segmentId}`;
  return `preview:${JSON.stringify(options.conditionGroups || [])}`;
}

export function invalidateSegmentStats(key: string) {
  statsCache.delete(key);
}

function parseCurrency(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// --- Enrichment data fetchers ---

async function fetchCampaignLogEnrichment(
  storeId: string,
  customerIds: string[]
): Promise<Map<string, CampaignLogEnrichment>> {
  const result = new Map<string, CampaignLogEnrichment>();
  if (customerIds.length === 0) return result;

  try {
    // Dynamic import to avoid circular deps
    const { prisma } = await import('@/lib/prisma');

    // Raw SQL aggregation: count statuses, get latest dates per customerId
    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      totalReceived: bigint;
      totalOpened: bigint;
      totalClicked: bigint;
      lastMessageSentAt: Date | null;
      lastCampaignId: string | null;
      lastTemplateId: string | null;
    }>>`
      SELECT
        cl."customerId",
        COUNT(*) as "totalReceived",
        COUNT(cl."readAt") as "totalOpened",
        COUNT(cl."clickedAt") as "totalClicked",
        MAX(cl."createdAt") as "lastMessageSentAt",
        (SELECT cl2."campaignId" FROM "CampaignLog" cl2
         WHERE cl2."customerId" = cl."customerId"
         ORDER BY cl2."createdAt" DESC LIMIT 1) as "lastCampaignId",
        (SELECT c2."templateId" FROM "CampaignLog" cl3
         JOIN "Campaign" c2 ON c2.id = cl3."campaignId"
         WHERE cl3."customerId" = cl."customerId"
         ORDER BY cl3."createdAt" DESC LIMIT 1) as "lastTemplateId"
      FROM "CampaignLog" cl
      JOIN "Campaign" c ON c.id = cl."campaignId"
      WHERE c."storeId" = ${storeId}
      GROUP BY cl."customerId"
    `;

    for (const row of rows) {
      result.set(row.customerId, {
        totalReceived: Number(row.totalReceived),
        totalOpened: Number(row.totalOpened),
        totalClicked: Number(row.totalClicked),
        lastMessageSentAt: row.lastMessageSentAt ? row.lastMessageSentAt.getTime() : null,
        lastCampaignId: row.lastCampaignId,
        lastTemplateId: row.lastTemplateId,
      });
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch CampaignLog enrichment:', err);
  }

  return result;
}

async function fetchAbandonedCheckoutEnrichment(
  client: ShopifyClient
): Promise<Map<string, AbandonedCheckoutEnrichment>> {
  const result = new Map<string, AbandonedCheckoutEnrichment>();

  try {
    const response = await client.getAbandonedCheckouts({ limit: 250 });
    const checkouts = response.checkouts || [];

    for (const checkout of checkouts) {
      const email = checkout.email || checkout.customer?.email || '';
      if (!email) continue;
      const key = email.toLowerCase();
      const existing = result.get(key);
      const ts = checkout.created_at ? new Date(checkout.created_at).getTime() : null;

      if (existing) {
        existing.count += 1;
        if (ts && (!existing.lastAbandonedAt || ts > existing.lastAbandonedAt)) {
          existing.lastAbandonedAt = ts;
        }
      } else {
        result.set(key, { count: 1, lastAbandonedAt: ts });
      }
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch abandoned checkouts:', err);
  }

  return result;
}

async function fetchStorefrontEventEnrichment(
  storeId: string
): Promise<Map<string, StorefrontEventEnrichment>> {
  const result = new Map<string, StorefrontEventEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    // Check if StorefrontEvent table exists (it may not be migrated yet)
    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      eventType: string;
      resourceId: string | null;
    }>>`
      SELECT "customerId", "eventType", "resourceId"
      FROM "storefront_events"
      WHERE "storeId" = ${storeId} AND "customerId" IS NOT NULL
    `.catch(() => [] as Array<{ customerId: string; eventType: string; resourceId: string | null }>);

    for (const row of rows) {
      if (!row.customerId) continue;
      let entry = result.get(row.customerId);
      if (!entry) {
        entry = {
          productViewed: false,
          viewedProductIds: [],
          productAddedToCart: false,
          addedToCartProductIds: [],
          collectionViewed: false,
        };
        result.set(row.customerId, entry);
      }

      switch (row.eventType) {
        case 'product_viewed':
          entry.productViewed = true;
          if (row.resourceId && !entry.viewedProductIds.includes(row.resourceId)) {
            entry.viewedProductIds.push(row.resourceId);
          }
          break;
        case 'product_added_to_cart':
          entry.productAddedToCart = true;
          if (row.resourceId && !entry.addedToCartProductIds.includes(row.resourceId)) {
            entry.addedToCartProductIds.push(row.resourceId);
          }
          break;
        case 'collection_viewed':
          entry.collectionViewed = true;
          break;
      }
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch storefront events:', err);
  }

  return result;
}

export async function calculateSegmentStats(options: SegmentStatsOptions): Promise<SegmentStats> {
  const cacheKey = getCacheKey(options);
  const cached = statsCache.get(cacheKey);
  const now = Date.now();

  if (!options.forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
    const stats = { ...cached.stats };
    if (typeof options.sampleLimit === 'number' && cached.stats.customers) {
      stats.customers = cached.stats.customers.slice(0, options.sampleLimit);
    }
    return stats;
  }

  const conditionGroups = options.conditionGroups || [];

  const sourceCustomers: ShopifyCustomer[] = options.customers
    ? options.customers
    : await options.client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });

  const hasConditions = conditionGroups.length > 0 && conditionGroups.some(group => (group.conditions || []).length > 0);

  // Determine which enrichments are needed
  const requiresOrders = hasConditions && needsOrderEnrichment(conditionGroups);
  const requiresEngagement = hasConditions && options.storeId && needsEngagementEnrichment(conditionGroups);
  const requiresAbandoned = hasConditions && needsAbandonedCheckoutEnrichment(conditionGroups);
  const requiresRFM = hasConditions && needsRFMEnrichment(conditionGroups);
  const requiresStorefront = hasConditions && options.storeId && needsStorefrontEnrichment(conditionGroups);

  // Fetch all needed enrichments in parallel
  let ordersByCustomer: Map<string, ShopifyOrder[]> | null = null;
  let campaignLogMap: Map<string, CampaignLogEnrichment> | null = null;
  let abandonedMap: Map<string, AbandonedCheckoutEnrichment> | null = null;
  let rfmMap: Map<string | number, { recency: number; frequency: number; monetary: number }> | null = null;
  let storefrontMap: Map<string, StorefrontEventEnrichment> | null = null;

  const fetches: Promise<void>[] = [];

  if (requiresOrders) {
    fetches.push(
      options.client.fetchAll<ShopifyOrder>('orders', { limit: 250, status: 'any' }).then(allOrders => {
        ordersByCustomer = new Map();
        for (const order of allOrders) {
          const custEmail = (order.customer?.email || order.email || '').toLowerCase();
          if (!custEmail) continue;
          const existing = ordersByCustomer.get(custEmail) || [];
          existing.push(order);
          ordersByCustomer.set(custEmail, existing);
        }
      }).catch(err => {
        console.warn('[SegmentStats] Failed to fetch orders:', err);
      })
    );
  }

  if (requiresEngagement && options.storeId) {
    const customerIds = sourceCustomers.map(c => String(c.id));
    fetches.push(
      fetchCampaignLogEnrichment(options.storeId, customerIds).then(map => {
        campaignLogMap = map;
      })
    );
  }

  if (requiresAbandoned) {
    fetches.push(
      fetchAbandonedCheckoutEnrichment(options.client).then(map => {
        abandonedMap = map;
      })
    );
  }

  if (requiresStorefront && options.storeId) {
    fetches.push(
      fetchStorefrontEventEnrichment(options.storeId).then(map => {
        storefrontMap = map;
      })
    );
  }

  await Promise.all(fetches);

  // RFM is calculated from customer data (no external fetch needed), but depends on order data if available
  if (requiresRFM) {
    rfmMap = calculateRFMScores(sourceCustomers);
  }

  const filteredCustomers = (!hasConditions
    ? sourceCustomers
    : sourceCustomers.filter(customer => {
        try {
          const custEmail = (customer.email || '').toLowerCase();
          const custId = String(customer.id);

          const enrichment: CustomerEnrichment = {};

          if (ordersByCustomer) {
            enrichment.orders = ordersByCustomer.get(custEmail) || [];
          }
          if (campaignLogMap) {
            enrichment.campaignLogs = campaignLogMap.get(custId);
          }
          if (abandonedMap) {
            enrichment.abandonedCheckouts = abandonedMap.get(custEmail);
          }
          if (rfmMap) {
            enrichment.rfm = rfmMap.get(customer.id);
          }
          if (storefrontMap) {
            enrichment.storefrontEvents = storefrontMap.get(custId);
          }

          return matchesGroups(customer, conditionGroups, enrichment);
        } catch (error) {
          console.error('[SegmentStats] Failed to evaluate customer', customer.id, error);
          return false;
        }
      })) as ShopifyCustomer[];

  const customerCount = filteredCustomers.length;
  const totalValue = filteredCustomers.reduce((sum, customer) => sum + parseCurrency(customer.total_spent), 0);
  const totalOrders = filteredCustomers.reduce((sum, customer) => sum + Number(customer.orders_count || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

  const stats: SegmentStats = {
    customerCount,
    totalValue,
    totalOrders,
    avgOrderValue,
    lastUpdated: now,
    customers: filteredCustomers.slice(0, options.sampleLimit ?? filteredCustomers.length),
  };

  statsCache.set(cacheKey, {
    stats: { ...stats, customers: filteredCustomers },
    timestamp: now,
  });

  return stats;
}
