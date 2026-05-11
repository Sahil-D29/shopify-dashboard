import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { Product } from '@/lib/types';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const client = getShopifyClient(request);
    const product = await client.getProduct<Product>(params.id);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch product', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
