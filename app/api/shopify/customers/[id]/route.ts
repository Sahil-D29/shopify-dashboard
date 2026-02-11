export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomerResponse, ShopifyOrderListResponse } from '@/lib/shopify/client';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const client = getShopifyClient(request);
    const { id } = await params;
    const customerResponse: ShopifyCustomerResponse = await client.getCustomer(id);
    const ordersResponse: ShopifyOrderListResponse = await client.getCustomerOrders(id);
    return NextResponse.json({ customer: customerResponse.customer, orders: ordersResponse.orders });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch customer', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
