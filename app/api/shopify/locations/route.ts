export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
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
    console.log('📍 GET /api/shopify/locations - Fetching from Shopify');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    console.log('📋 Request params:', { forceRefresh });

    const cacheKey = 'locations';

    if (!forceRefresh) {
      const cached = cache.get<LocationsCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached locations:', cached.locations.length);
        return NextResponse.json({ locations: cached.locations, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    console.log('📥 Fetching locations from Shopify...');
    const locationsResponse = await client.request<{ locations?: ShopifyLocation[] }>('/locations.json');
    
    // Shopify returns { locations: [...] }
    const locations = locationsResponse.locations || [];
    console.log(`✅ Fetched ${locations.length} locations from Shopify`);

    const lastSynced = Date.now();

    console.log(`💾 Caching ${locations.length} locations`);
    cache.set<LocationsCacheEntry>(cacheKey, { locations, lastSynced });

    const response: ShopifyLocationListResponse = {
      locations,
      lastSynced,
    };

    console.log('✅ Returning locations response');
    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/shopify/locations:', {
      error,
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

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

