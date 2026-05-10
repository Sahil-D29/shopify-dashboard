import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

interface CachedSegmentEvaluation {
  segmentId: string;
  customerIds: string[];
  customerCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  cachedAt: number;
  expiresAt: number;
}

interface SegmentCache {
  [segmentId: string]: CachedSegmentEvaluation;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: SegmentCache = {};

/**
 * Get cached segment evaluation
 */
export function getCachedEvaluation(segmentId: string): CachedSegmentEvaluation | null {
  const cached = cache[segmentId];
  
  if (!cached) {
    return null;
  }

  // Check if cache expired
  if (Date.now() > cached.expiresAt) {
    delete cache[segmentId];
    return null;
  }

  return cached;
}

/**
 * Cache segment evaluation
 */
export function cacheEvaluation(
  segmentId: string,
  customerIds: string[],
  customerCount: number,
  totalRevenue: number,
  averageOrderValue: number
): void {
  const now = Date.now();
  cache[segmentId] = {
    segmentId,
    customerIds,
    customerCount,
    totalRevenue,
    averageOrderValue,
    cachedAt: now,
    expiresAt: now + CACHE_TTL,
  };
}

/**
 * Invalidate cache for a segment
 */
export function invalidateSegment(segmentId: string): void {
  delete cache[segmentId];
}

/**
 * Invalidate all caches
 */
export function invalidateAll(): void {
  Object.keys(cache).forEach(key => delete cache[key]);
}

/**
 * Invalidate caches affected by customer update
 */
export function invalidateForCustomer(customerId: string): void {
  // Invalidate all segments that might include this customer
  // For efficiency, we could track which segments include which customers
  // For now, invalidate all
  invalidateAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalCached: number;
  expired: number;
  valid: number;
} {
  const now = Date.now();
  let expired = 0;
  let valid = 0;

  Object.values(cache).forEach(cached => {
    if (now > cached.expiresAt) {
      expired++;
    } else {
      valid++;
    }
  });

  return {
    totalCached: Object.keys(cache).length,
    expired,
    valid,
  };
}

