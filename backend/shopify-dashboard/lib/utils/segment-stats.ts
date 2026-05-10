import type { SegmentGroup } from '@/lib/types/segment';
import type { ShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { matchesGroups } from '@/lib/segments/evaluator';

export interface SegmentStatsOptions {
  client: ShopifyClient;
  segmentId?: string;
  conditionGroups?: SegmentGroup[];
  cacheKey?: string;
  forceRefresh?: boolean;
  sampleLimit?: number;
  customers?: ShopifyCustomer[];
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

  const filteredCustomers = (!hasConditions
    ? sourceCustomers
    : sourceCustomers.filter(customer => {
        try {
          return matchesGroups(customer, conditionGroups);
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


