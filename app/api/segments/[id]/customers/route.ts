export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Customer } from '@/lib/types/customer';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { mapShopifyToUiCustomer } from '@/lib/segments/mapper';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

// Ensure this route runs on Node.js runtime (not edge)
export const runtime = 'nodejs';

interface RouteParams {
  id: string;
}

interface SegmentCustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const mapShopifyToCustomer = (shopifyCustomer: ShopifyCustomer): Customer => {
  const ui = mapShopifyToUiCustomer(shopifyCustomer);
  return {
    ...ui,
    email: ui.email ?? '',
    segments: [],
  };
};

const filterBySearch = (customers: Customer[], search: string): Customer[] => {
  if (!search.trim()) return customers;
  const lookup = search.toLowerCase();
  return customers.filter(customer => {
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const email = customer.email.toLowerCase();
    const phone = customer.phone ?? '';
    return fullName.includes(lookup) || email.includes(lookup) || phone.includes(search);
  });
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { id: segmentId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 20);
    const search = searchParams.get('search') ?? '';

    // Get user context for store filtering
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    // Scope segment lookup to user's store access
    const row = await prisma.segment.findFirst({
      where: storeFilter.allowAll ? { id: segmentId } : storeFilter.storeId ? { id: segmentId, storeId: storeFilter.storeId } : { id: '__NO_SEGMENT__' },
    });
    const filters = (row?.filters ?? {}) as any;
    const segment: CustomerSegment | null = row
      ? {
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          type: filters.type ?? 'DYNAMIC',
          conditionGroups: filters.conditionGroups ?? [],
          customerIds: filters.customerIds,
          source: filters.source,
          importMetadata: filters.importMetadata,
          customerCount: row.customerCount ?? 0,
          totalRevenue: filters.totalRevenue ?? 0,
          averageOrderValue: filters.averageOrderValue ?? 0,
          createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Date.now(),
          updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Date.now(),
          lastCalculated: filters.lastCalculated,
          folderId: filters.folderId,
          isArchived: Boolean(filters.isArchived),
          storeId: row.storeId,
        }
      : null;
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }
    // Resolve the matching audience via the shared, Contact-aware engine (Contacts ⋃ Shopify
    // customers, deduped). This lists webhook/custom-event contacts too and never hangs on Shopify.
    const { getShopifyClientAsync } = await import('@/lib/shopify/api-helper');
    const { calculateSegmentStats } = await import('@/lib/utils/segment-stats');
    const client = await getShopifyClientAsync(request);
    const stats = await calculateSegmentStats({
      client,
      segmentId: segment.id,
      conditionGroups: segment.conditionGroups ?? [],
      storeId: storeFilter.storeId || undefined,
      forceRefresh: false,
    });
    let matchedShopifyCustomers = (stats.customers ?? []) as ShopifyCustomer[];
    // Static/custom audiences are an explicit id list — filter the resolved audience to it.
    if (segment.type === 'custom' && Array.isArray(segment.customerIds)) {
      const ids = new Set(segment.customerIds.map(String));
      matchedShopifyCustomers = matchedShopifyCustomers.filter(c => ids.has(String(c.id)));
    }

    const uniqueCustomers = new Map<string, Customer>();
    matchedShopifyCustomers.forEach(customer => {
      const mapped = mapShopifyToCustomer(customer);
      uniqueCustomers.set(mapped.id, mapped);
    });

    const dedupedCustomers = filterBySearch(Array.from(uniqueCustomers.values()), search);

    const total = dedupedCustomers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = dedupedCustomers.slice(startIndex, endIndex);

    const response: SegmentCustomersResponse = {
      customers: paginatedCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: endIndex < total,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Segments][Customers] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
  }
}

