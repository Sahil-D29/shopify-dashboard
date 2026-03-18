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
  needsJourneyEnrichment,
  needsFlowEnrichment,
  needsConversationEnrichment,
  needsContactEnrichment,
  type CustomerEnrichment,
  type CampaignLogEnrichment,
  type AbandonedCheckoutEnrichment,
  type StorefrontEventEnrichment,
  type JourneyEnrichment,
  type FlowEnrichment,
  type ConversationEnrichment,
  type ContactEnrichment,
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
    const { prisma } = await import('@/lib/prisma');

    // Aggregate stats per customer
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

    // Fetch detailed logs for sub-filter support
    const detailedLogs = await prisma.$queryRaw<Array<{
      customerId: string;
      campaignId: string;
      campaignName: string | null;
      templateName: string | null;
      campaignType: string | null;
      status: string;
      createdAt: Date;
      readAt: Date | null;
      clickedAt: Date | null;
      convertedAt: Date | null;
      convertedAmount: number | null;
    }>>`
      SELECT
        cl."customerId",
        cl."campaignId",
        c."name" as "campaignName",
        c."templateId" as "templateName",
        c."type" as "campaignType",
        cl."status",
        cl."createdAt",
        cl."readAt",
        cl."clickedAt",
        cl."convertedAt",
        cl."convertedAmount"
      FROM "CampaignLog" cl
      JOIN "Campaign" c ON c.id = cl."campaignId"
      WHERE c."storeId" = ${storeId}
      ORDER BY cl."createdAt" DESC
    `.catch(() => [] as Array<any>);

    // Build logs map by customer
    const logsMap = new Map<string, CampaignLogEnrichment['logs']>();
    for (const log of detailedLogs) {
      if (!logsMap.has(log.customerId)) logsMap.set(log.customerId, []);
      logsMap.get(log.customerId)!.push({
        campaignId: log.campaignId,
        campaignName: log.campaignName || undefined,
        templateName: log.templateName || undefined,
        campaignType: log.campaignType || undefined,
        status: log.status,
        createdAt: log.createdAt.getTime(),
        readAt: log.readAt?.getTime() ?? null,
        clickedAt: log.clickedAt?.getTime() ?? null,
        convertedAt: log.convertedAt?.getTime() ?? null,
        convertedAmount: log.convertedAmount ? Number(log.convertedAmount) : null,
      });
    }

    for (const row of rows) {
      result.set(row.customerId, {
        totalReceived: Number(row.totalReceived),
        totalOpened: Number(row.totalOpened),
        totalClicked: Number(row.totalClicked),
        lastMessageSentAt: row.lastMessageSentAt ? row.lastMessageSentAt.getTime() : null,
        lastCampaignId: row.lastCampaignId,
        lastTemplateId: row.lastTemplateId,
        logs: logsMap.get(row.customerId) || [],
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

async function fetchJourneyEnrichment(
  storeId: string
): Promise<Map<string, JourneyEnrichment>> {
  const result = new Map<string, JourneyEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      journeyId: string;
      journeyName: string | null;
      status: string;
      currentNode: string | null;
      enrolledAt: Date;
      completedAt: Date | null;
    }>>`
      SELECT
        je."customerId",
        je."journeyId",
        j."name" as "journeyName",
        je."status",
        je."currentNode",
        je."createdAt" as "enrolledAt",
        je."completedAt"
      FROM "JourneyEnrollment" je
      JOIN "Journey" j ON j.id = je."journeyId"
      WHERE j."storeId" = ${storeId}
      ORDER BY je."createdAt" DESC
    `.catch(() => [] as Array<any>);

    for (const row of rows) {
      if (!row.customerId) continue;
      if (!result.has(row.customerId)) {
        result.set(row.customerId, { enrollments: [] });
      }
      result.get(row.customerId)!.enrollments.push({
        journeyId: row.journeyId,
        journeyName: row.journeyName || undefined,
        status: row.status,
        currentNode: row.currentNode,
        enrolledAt: row.enrolledAt.getTime(),
        completedAt: row.completedAt?.getTime() ?? null,
      });
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch journey enrichment:', err);
  }

  return result;
}

async function fetchFlowEnrichment(
  storeId: string
): Promise<Map<string, FlowEnrichment>> {
  const result = new Map<string, FlowEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    const rows = await prisma.$queryRaw<Array<{
      contactId: string;
      flowId: string;
      flowName: string | null;
      completedAt: Date | null;
      responseData: any;
      createdAt: Date;
    }>>`
      SELECT
        fr."contactId",
        fr."flowId",
        f."name" as "flowName",
        fr."completedAt",
        fr."responseData",
        fr."createdAt"
      FROM "WhatsAppFlowResponse" fr
      JOIN "WhatsAppFlow" f ON f.id = fr."flowId"
      WHERE f."storeId" = ${storeId}
      ORDER BY fr."createdAt" DESC
    `.catch(() => [] as Array<any>);

    for (const row of rows) {
      if (!row.contactId) continue;
      if (!result.has(row.contactId)) {
        result.set(row.contactId, { responses: [] });
      }
      result.get(row.contactId)!.responses.push({
        flowId: row.flowId,
        flowName: row.flowName || undefined,
        completedAt: row.completedAt?.getTime() ?? null,
        responseData: row.responseData || {},
        createdAt: row.createdAt.getTime(),
      });
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch flow enrichment:', err);
  }

  return result;
}

async function fetchConversationEnrichment(
  storeId: string
): Promise<Map<string, ConversationEnrichment>> {
  const result = new Map<string, ConversationEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    // Fetch conversations
    const convos = await prisma.$queryRaw<Array<{
      contactId: string;
      id: string;
      status: string;
      assignedTo: string | null;
      lastMessageAt: Date | null;
      closedAt: Date | null;
      unreadCount: number;
    }>>`
      SELECT
        c."contactId",
        c.id,
        c."status",
        c."assignedTo",
        c."lastMessageAt",
        c."closedAt",
        c."unreadCount"
      FROM "Conversation" c
      WHERE c."storeId" = ${storeId}
      ORDER BY c."lastMessageAt" DESC
    `.catch(() => [] as Array<any>);

    // Fetch message stats per contact
    const msgStats = await prisma.$queryRaw<Array<{
      contactId: string;
      totalInbound: bigint;
      totalOutbound: bigint;
      lastInboundAt: Date | null;
      lastOutboundAt: Date | null;
      lastStatus: string | null;
    }>>`
      SELECT
        m."contactId",
        COUNT(*) FILTER (WHERE m."direction" = 'INBOUND') as "totalInbound",
        COUNT(*) FILTER (WHERE m."direction" = 'OUTBOUND') as "totalOutbound",
        MAX(m."createdAt") FILTER (WHERE m."direction" = 'INBOUND') as "lastInboundAt",
        MAX(m."createdAt") FILTER (WHERE m."direction" = 'OUTBOUND') as "lastOutboundAt",
        (SELECT m2."status" FROM "Message" m2
         WHERE m2."contactId" = m."contactId"
         ORDER BY m2."createdAt" DESC LIMIT 1) as "lastStatus"
      FROM "Message" m
      JOIN "Conversation" cv ON cv.id = m."conversationId"
      WHERE cv."storeId" = ${storeId}
      GROUP BY m."contactId"
    `.catch(() => [] as Array<any>);

    const msgStatsMap = new Map<string, typeof msgStats[0]>();
    for (const stat of msgStats) {
      if (stat.contactId) msgStatsMap.set(stat.contactId, stat);
    }

    for (const convo of convos) {
      if (!convo.contactId) continue;
      if (!result.has(convo.contactId)) {
        const stats = msgStatsMap.get(convo.contactId);
        result.set(convo.contactId, {
          conversations: [],
          totalInbound: Number(stats?.totalInbound ?? 0),
          totalOutbound: Number(stats?.totalOutbound ?? 0),
          avgResponseTimeMinutes: null,
          lastInboundAt: stats?.lastInboundAt?.getTime() ?? null,
          lastOutboundAt: stats?.lastOutboundAt?.getTime() ?? null,
          lastMessageStatus: stats?.lastStatus ?? null,
        });
      }
      result.get(convo.contactId)!.conversations.push({
        id: convo.id,
        status: convo.status,
        assignedTo: convo.assignedTo,
        lastMessageAt: convo.lastMessageAt?.getTime() ?? null,
        closedAt: convo.closedAt?.getTime() ?? null,
        unreadCount: convo.unreadCount ?? 0,
      });
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch conversation enrichment:', err);
  }

  return result;
}

async function fetchContactEnrichment(
  storeId: string
): Promise<Map<string, ContactEnrichment>> {
  const result = new Map<string, ContactEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    const contacts = await prisma.$queryRaw<Array<{
      id: string;
      phone: string | null;
      email: string | null;
      source: string;
      optInStatus: string;
      optInAt: Date | null;
      customFields: any;
      tags: string[];
      createdAt: Date;
      shopifyCustomerId: string | null;
    }>>`
      SELECT
        id, phone, email, source, "optInStatus",
        "optInAt", "customFields", tags, "createdAt",
        "shopifyCustomerId"
      FROM "Contact"
      WHERE "storeId" = ${storeId}
    `.catch(() => [] as Array<any>);

    for (const contact of contacts) {
      // Key by shopifyCustomerId, phone, and email for flexible matching
      const enrichment: ContactEnrichment = {
        source: contact.source || '',
        optInStatus: contact.optInStatus || 'NOT_SET',
        optInAt: contact.optInAt?.getTime() ?? null,
        customFields: contact.customFields || {},
        tags: contact.tags || [],
        createdAt: contact.createdAt.getTime(),
        shopifyCustomerId: contact.shopifyCustomerId,
        email: contact.email,
        phone: contact.phone,
      };

      // Store by multiple keys for matching
      if (contact.shopifyCustomerId) {
        result.set(`shopify:${contact.shopifyCustomerId}`, enrichment);
      }
      if (contact.email) {
        result.set(`email:${contact.email.toLowerCase()}`, enrichment);
      }
      if (contact.phone) {
        result.set(`phone:${contact.phone}`, enrichment);
      }
      result.set(`contact:${contact.id}`, enrichment);
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch contact enrichment:', err);
  }

  return result;
}

/** Resolve a contact enrichment by trying multiple keys */
function resolveContactEnrichment(
  contactMap: Map<string, ContactEnrichment>,
  customer: ShopifyCustomer
): ContactEnrichment | undefined {
  // Try by Shopify customer ID
  const byShopify = contactMap.get(`shopify:${customer.id}`);
  if (byShopify) return byShopify;

  // Try by email
  if (customer.email) {
    const byEmail = contactMap.get(`email:${customer.email.toLowerCase()}`);
    if (byEmail) return byEmail;
  }

  // Try by phone
  if (customer.phone) {
    const byPhone = contactMap.get(`phone:${customer.phone}`);
    if (byPhone) return byPhone;
  }

  return undefined;
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
  const requiresJourneys = hasConditions && options.storeId && needsJourneyEnrichment(conditionGroups);
  const requiresFlows = hasConditions && options.storeId && needsFlowEnrichment(conditionGroups);
  const requiresConversations = hasConditions && options.storeId && needsConversationEnrichment(conditionGroups);
  const requiresContacts = hasConditions && options.storeId && needsContactEnrichment(conditionGroups);

  // Fetch all needed enrichments in parallel
  let ordersByCustomer: Map<string, ShopifyOrder[]> | null = null;
  let campaignLogMap: Map<string, CampaignLogEnrichment> | null = null;
  let abandonedMap: Map<string, AbandonedCheckoutEnrichment> | null = null;
  let rfmMap: Map<string | number, { recency: number; frequency: number; monetary: number }> | null = null;
  let storefrontMap: Map<string, StorefrontEventEnrichment> | null = null;
  let journeyMap: Map<string, JourneyEnrichment> | null = null;
  let flowMap: Map<string, FlowEnrichment> | null = null;
  let conversationMap: Map<string, ConversationEnrichment> | null = null;
  let contactMap: Map<string, ContactEnrichment> | null = null;

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

  if (requiresJourneys && options.storeId) {
    fetches.push(
      fetchJourneyEnrichment(options.storeId).then(map => {
        journeyMap = map;
      })
    );
  }

  if (requiresFlows && options.storeId) {
    fetches.push(
      fetchFlowEnrichment(options.storeId).then(map => {
        flowMap = map;
      })
    );
  }

  if (requiresConversations && options.storeId) {
    fetches.push(
      fetchConversationEnrichment(options.storeId).then(map => {
        conversationMap = map;
      })
    );
  }

  if (requiresContacts && options.storeId) {
    fetches.push(
      fetchContactEnrichment(options.storeId).then(map => {
        contactMap = map;
      })
    );
  }

  await Promise.all(fetches);

  // RFM is calculated from customer data
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
          if (journeyMap) {
            enrichment.journeys = journeyMap.get(custId);
          }
          if (flowMap) {
            enrichment.flows = flowMap.get(custId);
          }
          if (conversationMap) {
            enrichment.conversations = conversationMap.get(custId);
          }
          if (contactMap) {
            enrichment.contact = resolveContactEnrichment(contactMap, customer);
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
