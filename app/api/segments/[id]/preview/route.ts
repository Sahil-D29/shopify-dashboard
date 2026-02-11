export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { SegmentsStore } from '@/lib/data/segments-store';
import { matchesGroups } from '@/lib/segments/evaluator';
import { cache } from '@/lib/utils/cache';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { ShopifyCustomerListResponse } from '@/lib/shopify/client';

interface PreviewCustomer {
  id: string | number;
  name: string;
  email?: string | null;
}

interface SegmentPreviewResponse {
  count: number;
  customers: PreviewCustomer[];
}

interface RouteParams {
  id: string;
}

const CACHE_NAMESPACE = 'segment-preview';

const buildCacheKey = (segmentId: string): string => `${CACHE_NAMESPACE}:${segmentId}`;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const resolved = await params;
    const segment = SegmentsStore.get(resolved.id);
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const cacheKey = buildCacheKey(resolved.id);
    const cached = cache.get<SegmentPreviewResponse>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const client = getShopifyClient(request);
    const customersData = (await client.getCustomers({ limit: 250 })) as ShopifyCustomerListResponse;
    const allCustomers = (customersData.customers ?? []) as ShopifyCustomer[];

    const filtered = allCustomers.filter(customer => {
      try {
        return matchesGroups(customer, segment.conditionGroups ?? []);
      } catch (error) {
        console.error('[Segments][Preview] Failed to evaluate customer', customer.id, error);
        return false;
      }
    });

    const previewCustomers = filtered.slice(0, 5).map<PreviewCustomer>(customer => ({
      id: customer.id,
      name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim(),
      email: customer.email ?? null,
    }));

    const response: SegmentPreviewResponse = { count: filtered.length, customers: previewCustomers };
    cache.set(cacheKey, response, 2 * 60 * 1000);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error previewing segment:', error);
    return NextResponse.json({ error: 'Failed to preview segment', message: getErrorMessage(error) }, { status: 500 });
  }
}

