export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { resolveStore } from '@/lib/tenant/resolve-store';

export const runtime = 'nodejs';

interface ShopifyOrder {
  total_price?: string | number;
  financial_status?: string;
}

/** Parse the `page_info` cursor from Shopify's REST Link header (rel="next"). */
function nextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.split(',').find(part => part.includes('rel="next"'));
  if (!match) return null;
  const url = match.match(/<([^>]+)>/)?.[1];
  if (!url) return null;
  try {
    return new URL(url).searchParams.get('page_info');
  } catch {
    return null;
  }
}

async function shopifyCount(shop: string, token: string, apiVersion: string, resource: string, query = ''): Promise<number> {
  const res = await fetch(
    `https://${shop}/admin/api/${apiVersion}/${resource}/count.json${query ? `?${query}` : ''}`,
    { headers: { 'X-Shopify-Access-Token': token } },
  );
  if (!res.ok) return 0;
  const data = await res.json().catch(() => ({}));
  return Number(data?.count ?? 0);
}

export async function GET(request: NextRequest) {
  try {
    const store = await resolveStore(request);
    if (!store) {
      return NextResponse.json(
        { error: "No Shopify store connected. Please connect a store first." },
        { status: 400 }
      );
    }

    const { shop, token, apiVersion } = store;

    // Accurate counts via Shopify's count endpoints (not capped at 250).
    const [totalOrders, totalCustomers, totalProducts] = await Promise.all([
      shopifyCount(shop, token, apiVersion, 'orders', 'status=any'),
      shopifyCount(shop, token, apiVersion, 'customers'),
      shopifyCount(shop, token, apiVersion, 'products'),
    ]);

    // Sum revenue by paginating through orders (bounded to avoid runaway on
    // very large stores — 60 pages × 250 = up to 15k orders).
    let totalRevenue = 0;
    let countedOrders = 0;
    let pageInfo: string | null = null;
    const MAX_PAGES = 60;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ limit: '250', status: 'any' });
      // page_info cannot be combined with most filters except limit.
      if (pageInfo) {
        params.set('page_info', pageInfo);
        params.delete('status');
      } else {
        params.set('fields', 'total_price');
      }
      const res = await fetch(
        `https://${shop}/admin/api/${apiVersion}/orders.json?${params.toString()}`,
        { headers: { 'X-Shopify-Access-Token': token } },
      );
      if (!res.ok) break;
      const data = await res.json().catch(() => ({ orders: [] }));
      const orders: ShopifyOrder[] = data.orders ?? [];
      for (const order of orders) {
        totalRevenue += parseFloat(String(order.total_price ?? 0)) || 0;
      }
      countedOrders += orders.length;
      pageInfo = nextPageInfo(res.headers.get('link'));
      if (!pageInfo || orders.length === 0) break;
    }

    // Prefer the count endpoint for order count; fall back to what we summed.
    const orderCount = totalOrders || countedOrders;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return NextResponse.json({
      totalRevenue,
      totalOrders: orderCount,
      totalCustomers,
      totalProducts,
      averageOrderValue,
      revenueSampledOrders: countedOrders,
      lastSynced: Date.now(),
    }, { status: 200 });
  } catch (err: any) {
    console.error('Analytics API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to calculate analytics' },
      { status: 500 }
    );
  }
}
