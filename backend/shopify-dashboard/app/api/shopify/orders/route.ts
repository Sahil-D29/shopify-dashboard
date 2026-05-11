import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrder, ShopifyOrderListResponse } from '@/lib/shopify/client';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

interface OrdersCacheEntry {
  orders: ShopifyOrder[];
  lastSynced: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📦 GET /api/shopify/orders - Fetching from Shopify');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 10);

    console.log('📋 Request params:', { forceRefresh, limit });

    const cacheKey = `orders_${limit}`;

    if (!forceRefresh) {
      const cached = cache.get<OrdersCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached orders:', cached.orders.length);
        return NextResponse.json({ orders: cached.orders, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    console.log('📥 Fetching orders from Shopify...');
    const orders = await client.fetchAll<ShopifyOrder>('orders', { 
      status: 'any', 
      limit: Math.min(limit, 250) // Shopify max is 250
    });
    console.log(`✅ Fetched ${orders.length} orders from Shopify`);

    // Sort by created_at descending (most recent first) and limit
    const sortedOrders = orders
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);

    const lastSynced = Date.now();

    console.log(`💾 Caching ${sortedOrders.length} orders`);
    cache.set<OrdersCacheEntry>(cacheKey, { orders: sortedOrders, lastSynced });

    const response: ShopifyOrderListResponse = {
      orders: sortedOrders,
      lastSynced,
    };

    console.log('✅ Returning orders response');
    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/shopify/orders:', {
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
        error: 'Failed to fetch orders',
        message: errorMessage,
        orders: [],
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

