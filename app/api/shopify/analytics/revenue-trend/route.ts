export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrderListResponse } from '@/lib/shopify/client';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toCurrencyNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function GET(request: Request) {
  try {
    const client = getShopifyClient(request);
    const ordersData = (await client.getOrders({ limit: 250, status: 'any', order: 'created_at asc' })) as ShopifyOrderListResponse;
    const orders = (ordersData.orders ?? []) as ShopifyOrderListResponse['orders'];

    const now = new Date();
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

    const buckets = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }

    (orders || []).forEach(order => {
      const date = order?.created_at ? new Date(order.created_at) : null;
      if (!date) return;
      const key = date.toISOString().slice(0, 10);
      if (buckets.has(key)) {
        const current = buckets.get(key) ?? 0;
        buckets.set(key, current + toCurrencyNumber(order?.total_price));
      }
    });

    const trend = Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }));

    return NextResponse.json({ trend });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute revenue trend', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
