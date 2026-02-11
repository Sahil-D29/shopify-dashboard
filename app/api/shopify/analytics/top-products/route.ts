export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrderListResponse, ShopifyOrderLineItem } from '@/lib/shopify/client';

interface TopProduct {
  product_id: string;
  title: string;
  revenue: number;
  units: number;
}

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: Request) {
  try {
    const client = getShopifyClient(request);
    const ordersData = (await client.getOrders({ limit: 250, status: 'any' })) as ShopifyOrderListResponse;
    const orders = (ordersData.orders ?? []) as ShopifyOrderListResponse['orders'];

    const productMap = new Map<string, TopProduct>();

    (orders || []).forEach(order => {
      const lineItems = (order?.line_items ?? []) as ShopifyOrderLineItem[];
      lineItems.forEach(item => {
        const productId = String(item?.product_id ?? 'unknown');
        const title = typeof item?.title === 'string' ? item.title : 'Untitled product';
        const entry = productMap.get(productId) ?? {
          product_id: productId,
          title,
          revenue: 0,
          units: 0,
        };
        const quantity = toNumber(item?.quantity);
        const price = toNumber(item?.price);
        entry.revenue += quantity * price;
        entry.units += quantity;
        productMap.set(productId, entry);
      });
    });

    const top = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({ top });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute top products', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
