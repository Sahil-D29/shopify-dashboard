export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface RouteParams {
  resource: string;
  id: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<RouteParams> }) {
  try {
    const { resource, id } = await params;
    const client = getShopifyClient(request);
    const data = await client.fetchById(resource, id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch resource by id', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
