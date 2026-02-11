import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

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
    const order = await client.getOrder(id);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
