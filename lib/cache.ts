import { promises as fs } from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface CacheEntry<T> {
  data: T;
  updatedAt: number;
  topic?: string;
}

/**
 * Get cached data or fetch fresh data
 */
export async function getCachedOrFetch<T>(
  shop: string,
  endpoint: string,
  fetchFn: () => Promise<T>
): Promise<{ data: T; cached: boolean; lastUpdated: number }> {
  const shopDir = path.join(CACHE_DIR, shop.replace(/\.myshopify\.com$/, ''));
  const cacheFile = path.join(shopDir, `${endpoint.replace(/\//g, '_')}.json`);

  try {
    // Try to read cache
    const content = await fs.readFile(cacheFile, 'utf-8');
    const entry: CacheEntry<T> = JSON.parse(content);
    const age = Date.now() - entry.updatedAt;

    // Return cached data if fresh
    if (age < CACHE_TTL) {
      return {
        data: entry.data,
        cached: true,
        lastUpdated: entry.updatedAt,
      };
    }

    // Cache expired, fetch fresh data
    const data = await fetchFn();
    await updateCache(shop, endpoint, data);

    return {
      data,
      cached: false,
      lastUpdated: Date.now(),
    };
  } catch (error: any) {
    // Cache miss or error, fetch fresh data
    if (error.code !== 'ENOENT') {
      console.error('Cache read error:', error);
    }

    const data = await fetchFn();
    await updateCache(shop, endpoint, data);

    return {
      data,
      cached: false,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Update cache file
 */
async function updateCache<T>(shop: string, endpoint: string, data: T): Promise<void> {
  const shopDir = path.join(CACHE_DIR, shop.replace(/\.myshopify\.com$/, ''));
  try {
    await fs.mkdir(shopDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  const cacheFile = path.join(shopDir, `${endpoint.replace(/\//g, '_')}.json`);
  const entry: CacheEntry<T> = {
    data,
    updatedAt: Date.now(),
  };

  await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Get cache metadata
 */
export async function getCacheMetadata(shop: string, endpoint: string): Promise<{ lastUpdated: number | null; exists: boolean }> {
  const shopDir = path.join(CACHE_DIR, shop.replace(/\.myshopify\.com$/, ''));
  const cacheFile = path.join(shopDir, `${endpoint.replace(/\//g, '_')}.json`);

  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const entry: CacheEntry<any> = JSON.parse(content);
    return {
      lastUpdated: entry.updatedAt,
      exists: true,
    };
  } catch {
    return {
      lastUpdated: null,
      exists: false,
    };
  }
}


