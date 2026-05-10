import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomerResponse, ShopifyOrderListResponse } from '@/lib/shopify/client';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = getShopifyClient(request);
    const customerResponse: ShopifyCustomerResponse = await client.getCustomer(params.id);
    const ordersResponse: ShopifyOrderListResponse = await client.getCustomerOrders(params.id);
    return NextResponse.json({ customer: customerResponse.customer, orders: ordersResponse.orders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch customer', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
