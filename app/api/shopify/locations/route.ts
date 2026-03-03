export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClientAsync } from '@/lib/shopify/api-helper';
import type { ShopifyLocation, ShopifyLocationListResponse } from '@/lib/types/shopify-location';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface LocationsCacheEntry {
  locations: ShopifyLocation[];
  lastSynced: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = 'locations';

    if (!forceRefresh) {
      const cached = cache.get<LocationsCacheEntry>(cacheKey);
      if (cached) {
        return NextResponse.json({ locations: cached.locations, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
    }

    const client = await getShopifyClientAsync(request);

    const locationsResponse = await client.request<{ locations?: ShopifyLocation[] }>('/locations.json');
    
    // Shopify returns { locations: [...] }
    const locations = locationsResponse.locations || [];

    const lastSynced = Date.now();

    cache.set<LocationsCacheEntry>(cacheKey, { locations, lastSynced });

    const response: ShopifyLocationListResponse = {
      locations,
      lastSynced,
    };

    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('Error in GET /api/shopify/locations:', getErrorMessage(error));

    const errorMessage = getErrorMessage(error);
    const statusCode = error instanceof Error && 'status' in error 
      ? (error as { status?: number }).status || 500
      : 500;

    return NextResponse.json(
      {
        error: 'Failed to fetch locations',
        message: errorMessage,
        locations: [],
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

