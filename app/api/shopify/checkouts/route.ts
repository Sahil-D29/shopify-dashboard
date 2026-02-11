export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCheckout, ShopifyCheckoutListResponse } from '@/lib/types/shopify-checkout';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

interface CheckoutsCacheEntry {
  checkouts: ShopifyCheckout[];
  lastSynced: number;
}

// Explicitly handle unsupported methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(request: NextRequest) {
  try {
    console.log('🛒 GET /api/shopify/checkouts - Fetching from Shopify');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 10);

    console.log('📋 Request params:', { forceRefresh, limit });

    const cacheKey = `checkouts_${limit}`;

    if (!forceRefresh) {
      const cached = cache.get<CheckoutsCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached checkouts:', cached.checkouts.length);
        return NextResponse.json({ checkouts: cached.checkouts, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    console.log('📥 Fetching abandoned checkouts from Shopify...');
    // Fetch abandoned checkouts (open status)
    const checkoutsResponse = await client.getAbandonedCheckouts({ 
      status: 'open',
      limit: Math.min(limit, 250) // Shopify max is 250
    });
    
    // Shopify returns { checkouts: [...] }
    const allCheckouts = checkoutsResponse.checkouts || [];
    console.log(`✅ Fetched ${allCheckouts.length} abandoned checkouts from Shopify`);

    // Sort by created_at descending (most recent first) and limit
    const sortedCheckouts = allCheckouts
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);

    const lastSynced = Date.now();

    console.log(`💾 Caching ${sortedCheckouts.length} checkouts`);
    cache.set<CheckoutsCacheEntry>(cacheKey, { checkouts: sortedCheckouts as ShopifyCheckout[], lastSynced });

    const response: ShopifyCheckoutListResponse = {
      checkouts: sortedCheckouts as ShopifyCheckout[],
      lastSynced,
    };

    console.log('✅ Returning checkouts response');
    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/shopify/checkouts:', {
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
        error: 'Failed to fetch checkouts',
        message: errorMessage,
        checkouts: [],
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

