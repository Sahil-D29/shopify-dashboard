export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCheckoutResponse } from '@/lib/shopify/client';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

interface AbandonedCartCacheEntry {
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

    const cacheKey = `abandoned_carts_${limit}`;
    
    if (!forceRefresh) {
      const cached = cache.get<AbandonedCartCacheEntry>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    } else {
      cache.delete(cacheKey);
    }

    const client = getShopifyClient(request);
    const data = await client.getAbandonedCheckouts({ limit, status: 'open' });
    
    const checkouts = data.checkouts ?? [];
    const lastSynced = Date.now();
    
    cache.set<AbandonedCartCacheEntry>(cacheKey, {
      checkouts,
      lastSynced,
    });
    
    return NextResponse.json({
      checkouts,
      lastSynced,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch abandoned carts', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

