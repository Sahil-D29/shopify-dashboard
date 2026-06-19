export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { CustomerSegment } from '@/lib/types/segment';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { calculateSegmentStats } from '@/lib/utils/segment-stats';
import { getShopifyClientAsync, type ShopifyClient } from '@/lib/shopify/api-helper';
import { prisma } from '@/lib/prisma';

// Ensure this route runs on Node.js runtime (not edge)
export const runtime = 'nodejs';

interface SegmentCreationPayload {
  name: string;
  description?: string;
  type?: CustomerSegment['type'];
  conditionGroups?: CustomerSegment['conditionGroups'];
  customerCount?: number;
  totalRevenue?: number;
  averageOrderValue?: number;
  lastCalculated?: number;
  folderId?: string;
  isArchived?: boolean;
}

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | null): boolean => value === 'true';

const matchesSearch = (segment: CustomerSegment, search: string): boolean =>
  Boolean(
    segment.name?.toLowerCase().includes(search) ||
      segment.description?.toLowerCase().includes(search) ||
      segment.id?.toLowerCase().includes(search),
  );

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
    customerCount: row.customerCount ?? filters.customerCount ?? 0,
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

const updateSegmentStats = async (segmentId: string, next: { customerCount: number; totalRevenue: number; averageOrderValue: number; lastCalculated: number }) => {
  const existing = await prisma.segment.findUnique({ where: { id: segmentId }, select: { filters: true } });
  const currentFilters = (existing?.filters ?? {}) as any;
  const mergedFilters = {
    ...currentFilters,
    totalRevenue: next.totalRevenue,
    averageOrderValue: next.averageOrderValue,
    lastCalculated: next.lastCalculated,
  };
  await prisma.segment.update({
    where: { id: segmentId },
    data: {
      customerCount: next.customerCount,
      filters: mergedFilters,
    },
  });
};

export async function GET(request: NextRequest) {
  try {
    // Get user context for role-based access
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          segments: [] 
        },
        { status: 401 }
      );
    }

    // Get store ID from request
    let requestedStoreId = await getCurrentStoreId(request);

    // Build store filter based on user role
    let storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    // Fallback: if no store ID resolved from request or userContext, look up user's own store
    if (!storeFilter.allowAll && !storeFilter.storeId) {
      try {
        const userStore = await prisma.store.findFirst({
          where: { ownerId: userContext.userId },
          select: { id: true },
        });
        if (userStore) {
          storeFilter = { storeId: userStore.id, allowAll: false };
        }
      } catch (e) {
        console.warn('[Segments] Fallback store lookup failed:', e);
      }
    }

    const rows = await prisma.segment.findMany({
      where: storeFilter.allowAll ? undefined : storeFilter.storeId ? { storeId: storeFilter.storeId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const segments = rows.map(toCustomerSegment);
    
    const refresh = parseBoolean(request.nextUrl.searchParams.get('refresh'));
    const search = request.nextUrl.searchParams.get('search')?.toLowerCase() ?? '';
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 20);

    const filteredSegments = search ? segments.filter(segment => matchesSearch(segment, search)) : segments;

    // Create Shopify client once for all segment stats calculations
    let shopifyClient: ShopifyClient | null = null;
    try {
      shopifyClient = await getShopifyClientAsync(request);
    } catch (e) {
      console.warn('[Segments][GET] Failed to create Shopify client:', e);
    }

    // Calculate stats via Shopify API (with 2-min cache)
    const enrichedSegments = await Promise.all(
      filteredSegments.slice(0, limit).map(async segment => {
        try {
          if (!shopifyClient) throw new Error('No Shopify client');
          const stats = await calculateSegmentStats({
            client: shopifyClient,
            segmentId: segment.id,
            conditionGroups: segment.conditionGroups,
            forceRefresh: refresh,
            storeId: storeFilter.storeId || undefined,
          });

          const updatedSegment = {
            ...segment,
            customerCount: stats.customerCount,
            totalValue: stats.totalValue,
            totalRevenue: stats.totalValue,
            averageOrderValue: stats.avgOrderValue,
            lastUpdated: stats.lastUpdated,
            lastCalculated: stats.lastUpdated,
            usingCachedStats: false,
          };

          // Persist stats in database (best-effort)
          try {
            await updateSegmentStats(segment.id, {
              customerCount: stats.customerCount,
              totalRevenue: stats.totalValue,
              averageOrderValue: stats.avgOrderValue,
              lastCalculated: stats.lastUpdated,
            });
          } catch (saveError) {
            console.warn(`[Segments][GET] Failed to save stats for segment ${segment.id}:`, getErrorMessage(saveError));
          }

          return updatedSegment;
        } catch (statsError) {
          console.warn(`[Segments][GET] Failed to calculate stats for segment ${segment.id}:`, getErrorMessage(statsError));
          return {
            ...segment,
            customerCount: segment.customerCount ?? 0,
            totalValue: segment.totalRevenue ?? 0,
            averageOrderValue: segment.averageOrderValue ?? 0,
            lastUpdated: segment.lastCalculated ?? Date.now(),
            usingCachedStats: true,
          };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      segments: enrichedSegments,
      total: filteredSegments.length,
      search,
      fetchedAt: Date.now(),
    });
  } catch (error) {
    console.error('[Segments][GET] Error fetching segments:', error);
    
    // Always return 200 with empty array to prevent frontend crashes
    // Try to return segments even on error (graceful degradation)
    try {
      const userContext = await getUserContext(request);
      if (!userContext) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized',
          segments: [],
          total: 0,
        }, { status: 200 });
      }

      let storeFilter = buildStoreFilter(userContext, await getCurrentStoreId(request) || undefined);
      if (!storeFilter.allowAll && !storeFilter.storeId) {
        try {
          const userStore = await prisma.store.findFirst({ where: { ownerId: userContext.userId }, select: { id: true } });
          if (userStore) storeFilter = { storeId: userStore.id, allowAll: false };
        } catch { /* ignore */ }
      }
      const rows = await prisma.segment.findMany({
        where: storeFilter.allowAll ? undefined : storeFilter.storeId ? { storeId: storeFilter.storeId } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      const segments = rows.map(toCustomerSegment);
      const filteredSegments = segments;

      return NextResponse.json({
        success: false,
        segments: filteredSegments.map(s => ({
          ...s,
          customerCount: s.customerCount ?? 0,
          totalValue: s.totalRevenue ?? 0,
          averageOrderValue: s.averageOrderValue ?? 0,
          lastUpdated: s.lastCalculated ?? Date.now(),
          usingCachedStats: true,
        })),
        total: filteredSegments.length,
        error: 'Failed to enrich segments, showing cached data',
        details: getErrorMessage(error),
      }, { status: 200 });
    } catch (fallbackError) {
      // If even reading the file fails, return empty array
      return NextResponse.json({
        success: false,
        segments: [],
        total: 0,
        error: 'Failed to load segments',
        details: getErrorMessage(error),
      }, { status: 200 }); // Return 200 with empty array instead of 500
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user context
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get store ID based on role
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
    
    // Determine effective store ID
    let storeId: string;
    if (storeFilter.allowAll) {
      // ADMIN can create segments for any store, use requested or default
      storeId = requestedStoreId || userContext.storeId || 'default';
    } else if (storeFilter.storeId) {
      storeId = storeFilter.storeId;
    } else {
      return NextResponse.json(
        { error: 'Store context required' },
        { status: 400 }
      );
    }
    
    let data: SegmentCreationPayload;
    try {
      data = (await request.json()) as SegmentCreationPayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Check if segment with same name already exists in this store
    const existingSegment = await prisma.segment.findFirst({
      where: {
        storeId,
        name: { equals: data.name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existingSegment) {
      return NextResponse.json(
        { error: 'Segment with this name already exists' },
        { status: 409 }
      );
    }

    const created = await prisma.segment.create({
      data: {
        storeId,
        name: data.name,
        description: data.description ?? null,
        createdBy: userContext.userId,
        customerCount: data.customerCount || (data as any).customerIds?.length || 0,
        filters: {
          type: data.type || 'DYNAMIC',
          conditionGroups: data.conditionGroups || [],
          customerIds: (data as any).customerIds,
          source: (data as any).source,
          importMetadata: (data as any).importMetadata,
          totalRevenue: data.totalRevenue || 0,
          averageOrderValue: data.averageOrderValue || 0,
          lastCalculated: data.lastCalculated,
          folderId: data.folderId,
          isArchived: data.isArchived || false,
        } as any,
      },
    });
    const newSegment = toCustomerSegment(created);

    // Calculate customer count via Shopify API and persist (best-effort, non-blocking)
    try {
      const client = await getShopifyClientAsync(request);
      const stats = await calculateSegmentStats({
        client,
        segmentId: created.id,
        conditionGroups: data.conditionGroups || [],
        forceRefresh: true,
        storeId,
      });
      await updateSegmentStats(created.id, {
        customerCount: stats.customerCount,
        totalRevenue: stats.totalValue,
        averageOrderValue: stats.avgOrderValue,
        lastCalculated: stats.lastUpdated,
      });
      newSegment.customerCount = stats.customerCount;
    } catch (statsError) {
      console.warn('[Segments][POST] Failed to calculate initial stats:', getErrorMessage(statsError));
    }

    return NextResponse.json(
      {
        segment: newSegment,
        success: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating segment:', error);
    return NextResponse.json(
      { error: 'Failed to create segment', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
