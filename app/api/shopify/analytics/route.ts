import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrder } from '@/lib/shopify/client';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

interface AnalyticsCacheEntry {
  analytics: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    averageOrderValue: number;
    revenueGrowth: number;
    ordersGrowth: number;
    abandonedCarts?: number;
    abandonedCartsValue?: number;
    recentOrders?: number;
    previousOrders?: number;
  };
  lastSynced: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/shopify/analytics - Calculating analytics from Shopify data');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = 'analytics_summary';

    if (!forceRefresh) {
      const cached = cache.get<AnalyticsCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached analytics');
        return NextResponse.json({ ...cached.analytics, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, calculating fresh analytics');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    // Fetch orders to calculate analytics
    console.log('📥 Fetching orders from Shopify...');
    const orders = await client.fetchAll<ShopifyOrder>('orders', { status: 'any', limit: 250 });
    console.log(`✅ Fetched ${orders.length} orders from Shopify`);

    // Fetch customers for customer count
    console.log('📥 Fetching customers from Shopify...');
    const customers = await client.fetchAll('customers', { limit: 250 });
    console.log(`✅ Fetched ${customers.length} customers from Shopify`);

    // Fetch abandoned checkouts
    console.log('📥 Fetching abandoned checkouts from Shopify...');
    let abandonedCheckouts = 0;
    let abandonedCartsValue = 0;
    try {
      const checkoutsResponse = await client.getAbandonedCheckouts({ status: 'open', limit: 250 });
      const checkouts = checkoutsResponse.checkouts || [];
      abandonedCheckouts = checkouts.length;
      abandonedCartsValue = checkouts.reduce((sum, checkout) => {
        return sum + toNumber(checkout.total_price ?? 0, 0);
      }, 0);
      console.log(`✅ Found ${abandonedCheckouts} abandoned checkouts`);
    } catch (error) {
      console.warn('⚠️ Could not fetch abandoned checkouts:', getErrorMessage(error));
    }

    // Calculate analytics from orders
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const recentOrders = orders.filter(order => {
      const orderDate = order.processed_at ? new Date(order.processed_at).getTime() : 
                       order.created_at ? new Date(order.created_at).getTime() : 0;
      return orderDate >= oneWeekAgo;
    });

    const previousOrders = orders.filter(order => {
      const orderDate = order.processed_at ? new Date(order.processed_at).getTime() : 
                       order.created_at ? new Date(order.created_at).getTime() : 0;
      return orderDate >= twoWeeksAgo && orderDate < oneWeekAgo;
    });

    const totalRevenue = orders.reduce((sum, order) => {
      return sum + toNumber(order.total_price, 0);
    }, 0);

    const recentRevenue = recentOrders.reduce((sum, order) => {
      return sum + toNumber(order.total_price, 0);
    }, 0);

    const previousRevenue = previousOrders.reduce((sum, order) => {
      return sum + toNumber(order.total_price, 0);
    }, 0);

    const totalOrders = orders.length;
    const revenueGrowth = previousRevenue > 0 
      ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    const ordersGrowth = previousOrders.length > 0
      ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100
      : 0;

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalCustomers = customers.length;

    const analytics = {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      revenueGrowth,
      ordersGrowth,
      abandonedCarts: abandonedCheckouts,
      abandonedCartsValue,
      recentOrders: recentOrders.length,
      previousOrders: previousOrders.length,
    };

    const lastSynced = Date.now();

    console.log('💾 Caching analytics data');
    cache.set<AnalyticsCacheEntry>(cacheKey, { analytics, lastSynced });

    console.log('✅ Returning analytics response');
    return NextResponse.json({ ...analytics, lastSynced, cached: false });
  } catch (error) {
    console.error('❌ Error calculating analytics:', {
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
        error: 'Failed to calculate analytics',
        message: errorMessage,
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        averageOrderValue: 0,
        revenueGrowth: 0,
        ordersGrowth: 0,
        abandonedCarts: 0,
        abandonedCartsValue: 0,
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

