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
  needsCustomEventEnrichment,
  type CustomerEnrichment,
  type CampaignLogEnrichment,
  type AbandonedCheckoutEnrichment,
  type StorefrontEventEnrichment,
  type JourneyEnrichment,
  type FlowEnrichment,
  type ConversationEnrichment,
  type ContactEnrichment,
  type CustomEventEnrichment,
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
  /** Set when the customer population couldn't be loaded (e.g. Shopify auth error). */
  error?: string;
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

/** Product metadata cache for backfilling storefront events that lack rich metadata. */
interface ProductMeta { tags: string[]; type: string; vendor: string; price: number }
const productMetaCache = new Map<string, { ts: number; map: Map<string, ProductMeta> }>();
const PRODUCT_META_TTL = 5 * 60 * 1000; // 5 min

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}

/** Fetch (and cache) a store's product metadata map keyed by product id, for backfill. */
async function getProductMetaMap(
  storeId: string,
  client?: ShopifyClient
): Promise<Map<string, ProductMeta>> {
  const cached = productMetaCache.get(storeId);
  if (cached && Date.now() - cached.ts < PRODUCT_META_TTL) return cached.map;
  const map = new Map<string, ProductMeta>();
  if (!client) return map;
  try {
    const data = (await client.getProducts({ limit: 250 })) as { products?: Array<Record<string, unknown>> };
    for (const p of data.products ?? []) {
      const id = String((p as any).id ?? '');
      if (!id) continue;
      const variants = (p as any).variants as Array<{ price?: string | number }> | undefined;
      const price = variants?.length ? Number(variants[0].price ?? 0) : 0;
      map.set(id, {
        tags: normalizeTags((p as any).tags),
        type: String((p as any).product_type ?? ''),
        vendor: String((p as any).vendor ?? ''),
        price: Number.isFinite(price) ? price : 0,
      });
    }
    productMetaCache.set(storeId, { ts: Date.now(), map });
  } catch (err) {
    console.warn('[SegmentStats] Failed to backfill product metadata:', err);
  }
  return map;
}

async function fetchStorefrontEventEnrichment(
  storeId: string,
  client?: ShopifyClient
): Promise<Map<string, StorefrontEventEnrichment>> {
  const result = new Map<string, StorefrontEventEnrichment>();

  try {
    const { prisma } = await import('@/lib/prisma');

    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      eventType: string;
      resourceId: string | null;
      resourceTitle: string | null;
      metadata: unknown;
      createdAt: Date;
    }>>`
      SELECT "customerId", "eventType", "resourceId", "resourceTitle", "metadata", "createdAt"
      FROM "storefront_events"
      WHERE "storeId" = ${storeId} AND "customerId" IS NOT NULL
    `.catch(() => [] as Array<{ customerId: string; eventType: string; resourceId: string | null; resourceTitle: string | null; metadata: unknown; createdAt: Date }>);

    // Determine whether any product event lacks rich metadata → backfill from Shopify.
    const PRODUCT_EVENT_TYPES = new Set(['product_viewed', 'product_added_to_cart', 'product_removed_from_cart']);
    const needsBackfill = rows.some(r =>
      PRODUCT_EVENT_TYPES.has(r.eventType) &&
      r.resourceId &&
      !(r.metadata && typeof r.metadata === 'object' && (r.metadata as any).tags)
    );
    const productMeta = needsBackfill ? await getProductMetaMap(storeId, client) : new Map<string, ProductMeta>();

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
          viewedProducts: [],
          addedToCartProducts: [],
          viewedCollections: [],
          activeOnSite: false,
          lastActiveAt: null,
          searched: false,
          searchTerms: [],
          searchRecords: [],
          productRemovedFromCart: false,
          removedFromCartProducts: [],
        };
        result.set(row.customerId, entry);
      }

      const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {};
      const ts = row.createdAt ? new Date(row.createdAt).getTime() : Date.now();
      const fallback = row.resourceId ? productMeta.get(row.resourceId) : undefined;

      const buildProductRecord = () => ({
        id: row.resourceId ?? '',
        title: String(meta.title ?? row.resourceTitle ?? ''),
        tags: normalizeTags(meta.tags).length ? normalizeTags(meta.tags) : (fallback?.tags ?? []),
        type: String(meta.productType ?? meta.product_type ?? fallback?.type ?? ''),
        vendor: String(meta.vendor ?? fallback?.vendor ?? ''),
        price: Number(meta.price ?? fallback?.price ?? 0) || 0,
        timestamp: ts,
      });

      switch (row.eventType) {
        case 'product_viewed':
          entry.productViewed = true;
          if (row.resourceId && !entry.viewedProductIds.includes(row.resourceId)) {
            entry.viewedProductIds.push(row.resourceId);
          }
          entry.viewedProducts.push(buildProductRecord());
          break;
        case 'product_added_to_cart':
          entry.productAddedToCart = true;
          if (row.resourceId && !entry.addedToCartProductIds.includes(row.resourceId)) {
            entry.addedToCartProductIds.push(row.resourceId);
          }
          entry.addedToCartProducts.push(buildProductRecord());
          break;
        case 'collection_viewed':
          entry.collectionViewed = true;
          entry.viewedCollections.push({
            id: row.resourceId ?? '',
            title: String(meta.collectionTitle ?? meta.title ?? row.resourceTitle ?? ''),
            timestamp: ts,
          });
          break;
        case 'product_removed_from_cart':
          entry.productRemovedFromCart = true;
          entry.removedFromCartProducts.push(buildProductRecord());
          break;
        case 'active_on_site':
          entry.activeOnSite = true;
          if (!entry.lastActiveAt || ts > entry.lastActiveAt) entry.lastActiveAt = ts;
          break;
        case 'search_submitted': {
          const term = String(meta.query ?? meta.term ?? meta.searchTerm ?? row.resourceTitle ?? '').trim();
          entry.searched = true;
          if (term) {
            if (!entry.searchTerms.includes(term)) entry.searchTerms.push(term);
            entry.searchRecords.push({ term, timestamp: ts });
          }
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch storefront events:', err);
  }

  return result;
}

/**
 * Custom-event data lives in `storefront_events` keyed by `customerId` (a Contact.id or Shopify
 * id). It may be stored under the RAW event name (e.g. `hiu_tagged`, from webhook/other-source
 * ingestion) OR the `custom:<name>` prefix (from the in-app events API). We match both, scoped to
 * the event names the segment actually references, and index by the bare name so the evaluator's
 * `custom_event:<name>` lookup resolves.
 */
async function fetchCustomEventEnrichment(
  storeId: string,
  eventNames: string[],
): Promise<Map<string, CustomEventEnrichment>> {
  const result = new Map<string, CustomEventEnrichment>();
  if (!eventNames.length) return result;

  try {
    const { prisma } = await import('@/lib/prisma');
    const { Prisma } = await import('@prisma/client');

    // Accept both the raw name and the `custom:` prefixed form.
    const wanted = Array.from(new Set(eventNames.flatMap(n => [n, `custom:${n}`])));

    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      eventType: string;
      metadata: unknown;
      createdAt: Date;
    }>>(Prisma.sql`
      SELECT "customerId", "eventType", "metadata", "createdAt"
      FROM "storefront_events"
      WHERE "storeId" = ${storeId} AND "customerId" IS NOT NULL
        AND "eventType" IN (${Prisma.join(wanted)})
    `).catch(() => [] as Array<{ customerId: string; eventType: string; metadata: unknown; createdAt: Date }>);

    for (const row of rows) {
      if (!row.customerId) continue;
      const name = row.eventType.replace(/^custom:/, ''); // bare name (matches `custom_event:<name>`)
      if (!name) continue;

      let entry = result.get(row.customerId);
      if (!entry) {
        entry = { events: {} };
        result.set(row.customerId, entry);
      }
      if (!entry.events[name]) entry.events[name] = [];

      const props = (row.metadata && typeof row.metadata === 'object')
        ? row.metadata as Record<string, unknown>
        : {};
      entry.events[name].push({
        properties: props,
        timestamp: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      });
    }
  } catch (err) {
    console.warn('[SegmentStats] Failed to fetch custom events:', err);
  }

  return result;
}

/**
 * Whether the segment needs the Shopify customer list. Pure contact / custom-event / engagement
 * segments don't (their data lives on Contacts + storefront_events), so we skip the slow,
 * rate-limited Shopify fetch for them.
 */
function fieldIsNonShopify(field: string): boolean {
  return (
    field.startsWith('custom_event:') ||
    field.startsWith('contact_') ||
    field.startsWith('wa_') ||
    field.startsWith('chat_') ||
    field.startsWith('campaign_') ||
    field.startsWith('journey_') ||
    field.startsWith('flow_') ||
    field.startsWith('whatsapp_') ||
    [
      'event_product_viewed', 'viewed_product', 'event_product_added_to_cart',
      'added_product_to_cart', 'event_product_removed_from_cart', 'event_collection_viewed',
      'event_active_on_site', 'event_product_searched', 'event_cart_abandoned',
      'in_segment', 'in_journey', 'accepts_marketing',
    ].includes(field)
  );
}
function needsShopifyCustomers(conditionGroups: SegmentGroup[]): boolean {
  const hasAny = (conditionGroups || []).some(g => (g.conditions || []).length > 0);
  if (!hasAny) return true; // "all customers" style → include Shopify
  return (conditionGroups || []).some(g =>
    (g.conditions || []).some(c => !fieldIsNonShopify(c.field))
  );
}

/** Collect the custom-event names (`custom_event:<name>` → `<name>`) referenced by the segment. */
function customEventNames(conditionGroups: SegmentGroup[]): string[] {
  const names = new Set<string>();
  for (const g of conditionGroups || []) {
    for (const c of g.conditions || []) {
      if (typeof c.field === 'string' && c.field.startsWith('custom_event:')) {
        names.add(c.field.slice('custom_event:'.length));
      }
    }
  }
  return Array.from(names);
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

/**
 * A unified audience person: ShopifyCustomer-shaped, but may originate from a Contact (id is
 * then the Contact UUID). `__eventKeys` holds every id this person is known by (shopify id +
 * contact id) so event/enrichment maps keyed by either id attach to the merged person.
 */
type AudiencePerson = ShopifyCustomer & { __eventKeys: string[] };

const normEmail = (s: unknown): string => (s ? String(s).trim().toLowerCase() : '');
const normPhone = (s: unknown): string => (s ? String(s).replace(/[^\d]/g, '') : '');

function mapContactToCustomer(ct: Record<string, any>): AudiencePerson {
  const meta = (ct.metadata && typeof ct.metadata === 'object') ? ct.metadata : {};
  const tags = Array.isArray(ct.tags) ? ct.tags.join(', ') : (typeof ct.tags === 'string' ? ct.tags : '');
  const nameParts = typeof ct.name === 'string' ? ct.name.trim().split(/\s+/) : [];
  const canonicalId = (ct.shopifyCustomerId || ct.id) as unknown as number;
  return {
    id: canonicalId,
    email: ct.email ?? null,
    first_name: ct.firstName ?? (nameParts[0] || null),
    last_name: ct.lastName ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null),
    phone: ct.phone ?? null,
    created_at: ct.createdAt instanceof Date ? ct.createdAt.toISOString() : new Date().toISOString(),
    updated_at: ct.updatedAt instanceof Date ? ct.updatedAt.toISOString() : new Date().toISOString(),
    orders_count: Number(meta.orders_count ?? 0),
    total_spent: String(meta.total_spent ?? 0),
    state: 'enabled',
    verified_email: !!ct.email,
    tags,
    __eventKeys: [ct.shopifyCustomerId, ct.id].filter(Boolean).map(String),
  };
}

/**
 * Build the segment audience: the store's Contacts MERGED with Shopify customers, deduplicated
 * by identity (shopifyCustomerId → email → phone). Shopify is fetched gracefully — if it times
 * out / rate-limits / fails, the audience falls back to Contacts only (never throws/hangs).
 */
async function buildAudience(
  storeId: string | undefined,
  client: ShopifyClient,
  opts: { needShopify: boolean } = { needShopify: true },
): Promise<{ people: AudiencePerson[]; shopifyError?: string }> {
  // 1. Shopify customers (graceful) — only when the segment actually needs Shopify customer/
  //    order data. Pure contact/custom-event segments skip this entirely (fast, no rate-limit).
  let shopify: ShopifyCustomer[] = [];
  let shopifyError: string | undefined;
  if (opts.needShopify) {
    try {
      shopify = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    } catch (err) {
      shopifyError = err instanceof Error ? err.message : String(err);
      console.warn('[SegmentStats] Shopify customers unavailable, using Contacts only:', shopifyError);
    }
  }

  // 2. Contacts (the webhook/other-source audience)
  let contacts: Array<Record<string, any>> = [];
  if (storeId) {
    try {
      const { prisma } = await import('@/lib/prisma');
      contacts = await prisma.contact.findMany({ where: { storeId } });
    } catch (err) {
      console.warn('[SegmentStats] Failed to load contacts:', err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Merge/dedup
  const index = new Map<string, AudiencePerson>(); // identity key -> person
  const people: AudiencePerson[] = [];

  const keysFor = (opts: { shopifyId?: unknown; email?: unknown; phone?: unknown }): string[] => {
    const k: string[] = [];
    if (opts.shopifyId) k.push('s:' + String(opts.shopifyId));
    const e = normEmail(opts.email);
    if (e) k.push('e:' + e);
    const p = normPhone(opts.phone);
    if (p) k.push('p:' + p);
    return k;
  };
  const register = (person: AudiencePerson, keys: string[]) => {
    people.push(person);
    for (const key of keys) if (!index.has(key)) index.set(key, person);
  };

  // Seed with Shopify customers
  for (const c of shopify) {
    const person: AudiencePerson = { ...c, __eventKeys: [String(c.id)] };
    register(person, keysFor({ shopifyId: c.id, email: c.email, phone: c.phone ?? c.default_address?.phone }));
  }

  // Merge contacts into matching Shopify person, or add as new
  for (const ct of contacts) {
    const keys = keysFor({ shopifyId: ct.shopifyCustomerId, email: ct.email, phone: ct.phone });
    const match = keys.map(k => index.get(k)).find(Boolean);
    if (match) {
      // Merge: attach event keys + fill fields the Shopify side is missing
      for (const ek of [ct.shopifyCustomerId, ct.id].filter(Boolean).map(String)) {
        if (!match.__eventKeys.includes(ek)) match.__eventKeys.push(ek);
      }
      if (!match.phone && ct.phone) match.phone = ct.phone;
      if (!match.email && ct.email) match.email = ct.email;
      if (!match.first_name && ct.firstName) match.first_name = ct.firstName;
      if ((!match.tags || match.tags.length === 0) && Array.isArray(ct.tags) && ct.tags.length) {
        match.tags = ct.tags.join(', ');
      }
      // Index any new keys so later contacts dedup against this person too
      for (const k of keys) if (!index.has(k)) index.set(k, match);
    } else {
      register(mapContactToCustomer(ct), keys);
    }
  }

  return { people, shopifyError };
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

  let sourceCustomers: AudiencePerson[];
  let audienceShopifyError: string | undefined;
  if (options.customers) {
    // Caller-supplied pool (e.g. journey single-customer check) — use as-is.
    sourceCustomers = options.customers.map(c => ({
      ...c,
      __eventKeys: (c as AudiencePerson).__eventKeys ?? [String(c.id)],
    }));
  } else {
    const built = await buildAudience(options.storeId, options.client, {
      needShopify: needsShopifyCustomers(conditionGroups),
    });
    sourceCustomers = built.people;
    audienceShopifyError = built.shopifyError;
  }

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
  const requiresCustomEvents = hasConditions && options.storeId && needsCustomEventEnrichment(conditionGroups);

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
  let customEventMap: Map<string, CustomEventEnrichment> | null = null;

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
      fetchStorefrontEventEnrichment(options.storeId, options.client).then(map => {
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

  if (requiresCustomEvents && options.storeId) {
    fetches.push(
      fetchCustomEventEnrichment(options.storeId, customEventNames(conditionGroups)).then(map => {
        customEventMap = map;
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
          // Every id this person is known by (shopify id + contact id) — events/enrichment
          // keyed by EITHER id must attach to the merged person.
          const eventKeys = (customer as AudiencePerson).__eventKeys?.length
            ? (customer as AudiencePerson).__eventKeys
            : [custId];
          const lookupByKeys = <V>(m: Map<string, V> | null): V | undefined => {
            if (!m) return undefined;
            for (const k of eventKeys) {
              const v = m.get(k);
              if (v !== undefined) return v;
            }
            return undefined;
          };

          const enrichment: CustomerEnrichment = {};

          if (ordersByCustomer) {
            enrichment.orders = ordersByCustomer.get(custEmail) || [];
          }
          if (campaignLogMap) {
            enrichment.campaignLogs = lookupByKeys(campaignLogMap);
          }
          if (abandonedMap) {
            enrichment.abandonedCheckouts = abandonedMap.get(custEmail);
          }
          if (rfmMap) {
            enrichment.rfm = rfmMap.get(customer.id);
          }
          if (storefrontMap) {
            enrichment.storefrontEvents = lookupByKeys(storefrontMap);
          }
          if (journeyMap) {
            enrichment.journeys = lookupByKeys(journeyMap);
          }
          if (flowMap) {
            enrichment.flows = lookupByKeys(flowMap);
          }
          if (conversationMap) {
            enrichment.conversations = lookupByKeys(conversationMap);
          }
          if (contactMap) {
            enrichment.contact = resolveContactEnrichment(contactMap, customer);
          }
          if (customEventMap) {
            enrichment.customEvents = lookupByKeys(customEventMap);
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
    // Only flag an error when the result is actually degraded — i.e. the segment relies on
    // Shopify order data but Shopify was unreachable. Contact/custom-event segments are
    // unaffected by a Shopify outage and should not show an error.
    ...(audienceShopifyError && requiresOrders ? { error: audienceShopifyError } : {}),
  };

  statsCache.set(cacheKey, {
    stats: { ...stats, customers: filteredCustomers },
    timestamp: now,
  });

  return stats;
}
