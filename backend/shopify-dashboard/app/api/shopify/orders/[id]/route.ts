import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyOrder } from '@/lib/shopify/client';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = getShopifyClient(request);
    const order = await client.getOrder<ShopifyOrder>(params.id);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
