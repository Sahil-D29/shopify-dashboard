export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface RouteParams {
  resource: string;
  id: string;
  nested: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { resource, id, nested } = await params;
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const client = getShopifyClient(request);
    const data = await client.fetchNested(resource, id, nested, query);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch nested resource', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
