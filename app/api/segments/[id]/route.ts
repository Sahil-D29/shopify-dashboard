export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { CustomerSegment } from '@/lib/types/segment';
import { calculateSegmentStatsFromFiles } from '@/lib/utils/segment-stats-file-based';
import type { JourneyDefinition } from '@/lib/types/journey';
import type { Campaign } from '@/lib/types/campaign';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface RouteParams {
  id: string;
}

// Removed Shopify-based types - now using file-based calculation

const parseBoolean = (value: string | null): boolean => value === 'true';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toCustomerSegment = (row: any): CustomerSegment => {
  const filters = (row.filters ?? {}) as any;
  return {
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
  };
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { id: segmentId } = await params;

    // Get user context for store filtering
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const segmentRow = await prisma.segment.findFirst({
      where: storeFilter.allowAll ? { id: segmentId } : storeFilter.storeId ? { id: segmentId, storeId: storeFilter.storeId } : { id: '__NO_SEGMENT__' },
    });

    if (!segmentRow) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }
    const segment = toCustomerSegment(segmentRow);

    const refresh = parseBoolean(request.nextUrl.searchParams.get('refresh'));

    // Calculate stats from file-based customer data (same as list endpoint)
    const stats = await calculateSegmentStatsFromFiles({
      segmentId: segment.id,
      conditionGroups: segment.conditionGroups,
      storeId: storeFilter.storeId || undefined,
      forceRefresh: refresh,
    });

    // Get customers for the detail view (filtered by segment conditions)
    let filteredCustomers: any[] = [];
    
    try {
      // Fetch customers from Shopify
      const { getShopifyClient } = await import('@/lib/shopify/api-helper');
      const { mapShopifyToUiCustomer } = await import('@/lib/segments/mapper');
      const client = getShopifyClient(request);
      const shopifyCustomers = await client.fetchAll<any>('customers', { limit: 250 });
      
      const conditionGroups = segment.conditionGroups || [];
      const hasConditions = conditionGroups.length > 0 && 
        conditionGroups.some(group => (group.conditions || []).length > 0);
      
      if (hasConditions) {
        const { matchesGroups } = await import('@/lib/segments/evaluator');
        const matchedCustomers = shopifyCustomers.filter((customer: any) => {
          try {
            return matchesGroups(customer, conditionGroups);
          } catch (error) {
            return false;
          }
        });
        // Map to UI customer format
        filteredCustomers = matchedCustomers.map((customer: any) => mapShopifyToUiCustomer(customer));
      } else {
        // No conditions - return all customers
        filteredCustomers = shopifyCustomers.map((customer: any) => mapShopifyToUiCustomer(customer));
      }
    } catch (error) {
      console.warn('[Segments][GET /:id] Failed to fetch customers:', error);
      // Return empty array if customer fetch fails (non-critical)
      filteredCustomers = [];
    }

    const campaignsUsing = await prisma.campaign.count({ where: { segmentId } });
    const activeCampaigns = await prisma.campaign.count({
      where: { segmentId, status: { in: ['RUNNING', 'SCHEDULED'] as any } },
    });
    const journeysUsing = await prisma.journey.count({
      where: { storeId: segmentRow.storeId },
    });
    const activeJourneys = await prisma.journey.count({
      where: { storeId: segmentRow.storeId, status: 'ACTIVE' as any },
    });

    return NextResponse.json({
      segment: {
        ...segment,
        customerCount: stats.customerCount,
        totalValue: stats.totalValue,
        totalRevenue: stats.totalValue, // Keep for backward compatibility
        totalOrders: stats.totalOrders,
        averageOrderValue: stats.avgOrderValue,
        lastUpdated: stats.lastUpdated,
        lastCalculated: stats.lastUpdated, // Keep for backward compatibility
        customers: filteredCustomers.slice(0, 100), // Limit to 100 for detail view
        usingCachedStats: false, // File-based, not cached
        usage: {
          campaigns: campaignsUsing,
          activeCampaigns,
          journeys: journeysUsing,
          activeJourneys,
        },
      },
    });
  } catch (error) {
    console.error('[Segments][GET /:id] Error fetching segment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    let data: Partial<CustomerSegment>;
    try {
      data = (await request.json()) as Partial<CustomerSegment>;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const { id: segmentId } = await params;

    // Get user context for store filtering
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    // Scope segment lookup to user's store access
    const existing = await prisma.segment.findFirst({
      where: storeFilter.allowAll ? { id: segmentId } : storeFilter.storeId ? { id: segmentId, storeId: storeFilter.storeId } : { id: '__NO_SEGMENT__' },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    const existingFilters = (existing.filters ?? {}) as any;
    if (existingFilters.isSystem) {
      return NextResponse.json(
        { error: 'System segments cannot be updated' },
        { status: 400 }
      );
    }

    const mergedFilters = {
      ...existingFilters,
      type: data.type ?? existingFilters.type,
      conditionGroups: data.conditionGroups ?? existingFilters.conditionGroups,
      customerIds: (data as any).customerIds ?? existingFilters.customerIds,
      source: (data as any).source ?? existingFilters.source,
      importMetadata: (data as any).importMetadata ?? existingFilters.importMetadata,
      totalRevenue: (data as any).totalRevenue ?? existingFilters.totalRevenue,
      averageOrderValue: (data as any).averageOrderValue ?? existingFilters.averageOrderValue,
      lastCalculated: (data as any).lastCalculated ?? existingFilters.lastCalculated,
      folderId: (data as any).folderId ?? existingFilters.folderId,
      isArchived: (data as any).isArchived ?? existingFilters.isArchived,
    };

    // Scope update to user's store access
    const updated = await prisma.segment.update({
      where: storeFilter.allowAll ? { id: segmentId } : { id: segmentId, storeId: storeFilter.storeId! },
      data: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        customerCount: typeof data.customerCount === 'number' ? data.customerCount : undefined,
        filters: mergedFilters,
      },
    });

    return NextResponse.json({ segment: toCustomerSegment(updated) });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: segmentId } = await params;

    if (!segmentId) {
      console.warn('[Segments][DELETE] Missing segment id in request params');
      return NextResponse.json(
        { error: 'Segment id is required' },
        { status: 400 }
      );
    }

    // Get user context for store filtering
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    // Scope segment lookup to user's store access
    const segment = await prisma.segment.findFirst({
      where: storeFilter.allowAll ? { id: segmentId } : storeFilter.storeId ? { id: segmentId, storeId: storeFilter.storeId } : { id: '__NO_SEGMENT__' },
    });

    if (!segment) {
      console.warn('[Segments][DELETE] Segment not found', { segmentId });
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    const segmentFilters = (segment.filters ?? {}) as any;
    if (segmentFilters.isSystem) {
      console.warn('[Segments][DELETE] Attempt to delete system segment', { segmentId });
      return NextResponse.json(
        { error: 'System segments cannot be deleted' },
        { status: 400 }
      );
    }

    await prisma.campaign.updateMany({
      where: { segmentId },
      data: { segmentId: null },
    });

    console.info('[Segments][DELETE] Segment removed from store', {
      segmentId,
      storeId: segment.storeId,
    });

    await prisma.journeyEnrollment.deleteMany({
      where: { segmentId },
    });

    // Scope delete to user's store access
    await prisma.segment.delete({
      where: storeFilter.allowAll ? { id: segmentId } : { id: segmentId, storeId: storeFilter.storeId! },
    });

    return NextResponse.json({
      success: true,
      message: 'Segment deleted',
      removedFromCampaigns: true,
      updatedJourneys: 0,
    });
  } catch (error) {
    console.error('[Segments][DELETE] Failed to delete segment', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

