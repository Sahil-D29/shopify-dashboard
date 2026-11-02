import type { ShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { SegmentGroup } from '@/lib/types/segment';
import { calculateSegmentStats } from '@/lib/utils/segment-stats';

/**
 * Shared, enrichment-correct segment → customer resolution.
 *
 * Both campaign sends and the campaign reach estimate previously filtered with
 * `matchesGroups(customer, conditionGroups)` WITHOUT enrichment, so any segment
 * using orders, storefront events, campaign history, RFM, sub-filters, etc. matched
 * the wrong people. `calculateSegmentStats` already builds the needed enrichment and
 * returns the matching customer list, so it is the single source of truth here.
 */

interface ResolveOptions {
  client: ShopifyClient;
  storeId?: string;
  segmentIds: string[];
  /** Pre-fetched customer pool to reuse (avoids refetching from Shopify). */
  customers?: ShopifyCustomer[];
  forceRefresh?: boolean;
}

function extractConditionGroups(filters: unknown): SegmentGroup[] {
  if (filters && typeof filters === 'object') {
    const groups = (filters as { conditionGroups?: unknown }).conditionGroups;
    if (Array.isArray(groups)) return groups as SegmentGroup[];
  }
  return [];
}

/**
 * Resolve the customers matching ALL of the given segments (intersection — the
 * semantics campaigns used with `selectedSegments.every(...)`).
 * Returns the full Shopify pool when no segments are provided.
 */
export async function resolveSegmentCustomers(
  options: ResolveOptions,
): Promise<ShopifyCustomer[]> {
  const { client, storeId, segmentIds, customers, forceRefresh } = options;

  if (!storeId) throw new Error('Store context required for audience resolution');
  if (!segmentIds?.length) {
    const stats = await calculateSegmentStats({ client, storeId, customers, conditionGroups: [], forceRefresh });
    return (stats.customers ?? []) as ShopifyCustomer[];
  }
  const { prisma } = await import('@/lib/prisma');
  const segments = await prisma.segment.findMany({ where: { id: { in: segmentIds }, storeId } });
  if (segments.length !== new Set(segmentIds).size) throw new Error('Selected segment is unavailable in this store');
  const pool = new Map<string, ShopifyCustomer>();
  // Resolve each segment to its matching customer-id set, then intersect.
  let matchingIds: Set<string> | null = null;
  for (const segment of segments) {
    const conditionGroups = extractConditionGroups(segment.filters);
    const stats = await calculateSegmentStats({
      client,
      storeId,
      conditionGroups,
      customers,
      segmentId: segment.id,
      forceRefresh: forceRefresh ?? false,
    });
    (stats.customers ?? []).forEach(c => pool.set(String(c.id), c as ShopifyCustomer));
    const ids = new Set<string>((stats.customers ?? []).map(c => String(c.id)));
    if (matchingIds === null) {
      matchingIds = ids;
    } else {
      const prev: Set<string> = matchingIds;
      matchingIds = new Set<string>([...prev].filter(id => ids.has(id)));
    }
  }

  if (!matchingIds) return [];
  return [...pool.values()].filter(c => matchingIds!.has(String(c.id)));
}

/**
 * Single-customer membership check for a segment (used by journey entry gating).
 * Reuses the same enrichment-correct matching by passing a one-element pool.
 */
export async function customerInSegment(
  customer: ShopifyCustomer,
  segmentId: string,
  ctx: { client: ShopifyClient; storeId?: string },
): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma');
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return false;
  const conditionGroups = extractConditionGroups(segment.filters);
  if (conditionGroups.length === 0) return true; // no conditions → everyone matches

  const stats = await calculateSegmentStats({
    client: ctx.client,
    storeId: ctx.storeId,
    conditionGroups,
    customers: [customer],
    forceRefresh: false,
  });
  return (stats.customerCount ?? 0) > 0;
}
