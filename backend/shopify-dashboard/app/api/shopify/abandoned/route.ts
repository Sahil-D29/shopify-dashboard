import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { cache } from '@/lib/utils/cache';
import type { ShopifyCheckoutResponse } from '@/lib/shopify/client';

export const runtime = 'nodejs';

interface AbandonedCacheEntry {
  checkouts: ShopifyCheckoutResponse['checkouts'];
  lastSynced: number;
}

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 250);

    const cacheKey = `abandoned_checkouts_${limit}`;
    
    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = cache.get<AbandonedCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached abandoned checkouts');
        return NextResponse.json({
          checkouts: cached.checkouts,
          lastSynced: cached.lastSynced,
          cached: true,
        });
      }
    }

    console.log('🔄 Fetching abandoned checkouts from Shopify...');
    const client = getShopifyClient(request);
    const data: ShopifyCheckoutResponse = await client.getAbandonedCheckouts({ limit });
    
    const checkouts = data.checkouts ?? [];
    const lastSynced = Date.now();
    
    // Cache the result
    cache.set<AbandonedCacheEntry>(cacheKey, {
      checkouts,
      lastSynced,
    });
    
    console.log(`✅ Fetched ${checkouts.length} abandoned checkouts from Shopify`);
    
    return NextResponse.json({
      checkouts,
      lastSynced,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching abandoned checkouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch abandoned checkouts', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

