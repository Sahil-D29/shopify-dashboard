import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { matchesGroups } from '@/lib/segments/evaluator';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SegmentSyncResult {
  segmentId: string;
  segmentName: string;
  customerCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  lastCalculated: number;
  success: boolean;
  error?: string;
  duration: number;
}

interface SegmentSyncStatus {
  isRunning: boolean;
  lastRun?: number;
  nextRun?: number;
  results?: SegmentSyncResult[];
  error?: string;
  needsUpdate?: boolean;
  lastTriggered?: number;
  triggerTopic?: string;
}

const SYNC_STATUS_ID = 'singleton'; // Single record ID for system-wide status
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Sync a single segment
 */
export async function syncSegment(
  segment: CustomerSegment,
  customers: ShopifyCustomer[]
): Promise<SegmentSyncResult> {
  const startTime = Date.now();
  
  try {
    // Evaluate segment against customers
    const matchingCustomers = customers.filter(customer =>
      matchesGroups(customer, segment.conditionGroups || [])
    );

    // Calculate statistics
    const totalRevenue = matchingCustomers.reduce(
      (sum, c) => sum + (Number(c.total_spent) || 0),
      0
    );
    const totalOrders = matchingCustomers.reduce(
      (sum, c) => sum + (Number(c.orders_count) || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const result: SegmentSyncResult = {
      segmentId: segment.id,
      segmentName: segment.name,
      customerCount: matchingCustomers.length,
      totalRevenue,
      averageOrderValue,
      lastCalculated: Date.now(),
      success: true,
      duration: Date.now() - startTime,
    };

    // Update segment with new stats (database)
    const existing = await prisma.segment.findUnique({ where: { id: segment.id }, select: { filters: true } });
    const filters = (existing?.filters ?? {}) as any;
    await prisma.segment.update({
      where: { id: segment.id },
      data: {
        customerCount: result.customerCount,
        filters: {
          ...filters,
          totalRevenue: result.totalRevenue,
          averageOrderValue: result.averageOrderValue,
          lastCalculated: result.lastCalculated,
        },
      },
    });

    return result;
  } catch (error) {
    return {
      segmentId: segment.id,
      segmentName: segment.name,
      customerCount: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      lastCalculated: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Sync all segments
 */
export async function syncAllSegments(request?: NextRequest): Promise<SegmentSyncResult[]> {
  try {
    // Load segments (database)
    const rows = await prisma.segment.findMany({ orderBy: { createdAt: 'desc' } });
    const segments = rows.map((row: (typeof rows)[number]) => {
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
      } satisfies CustomerSegment;
    });
    
    // Filter out custom segments (they don't need evaluation)
    const dynamicSegments = segments.filter((s: CustomerSegment) => s.type !== 'custom');
    
    if (dynamicSegments.length === 0) {
      return [];
    }

    // Fetch customers from Shopify
    let customers: ShopifyCustomer[] = [];
    try {
      const client = request ? getShopifyClient(request) : null;
      if (client) {
        customers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
      } else {
        // Fallback: try to load from cache or use empty array
        console.warn('No Shopify client available, using cached data');
      }
    } catch (error) {
      console.error('Error fetching customers for segment sync:', error);
      // Continue with empty customers array for segments that don't need Shopify data
    }

    // Sync each segment
    const results = await Promise.all(
      dynamicSegments.map((segment: CustomerSegment) => syncSegment(segment, customers))
    );

    // Update sync status in database
    const status: SegmentSyncStatus = {
      isRunning: false,
      lastRun: Date.now(),
      nextRun: Date.now() + SYNC_INTERVAL,
      results,
    };
    
    try {
      await prisma.segmentSyncStatus.upsert({
        where: { id: SYNC_STATUS_ID },
        update: {
          isRunning: status.isRunning,
          lastRun: status.lastRun ? new Date(status.lastRun) : null,
          nextRun: status.nextRun ? new Date(status.nextRun) : null,
          results: status.results as any,
          error: status.error ?? null,
        },
        create: {
          id: SYNC_STATUS_ID,
          isRunning: status.isRunning,
          lastRun: status.lastRun ? new Date(status.lastRun) : null,
          nextRun: status.nextRun ? new Date(status.nextRun) : null,
          results: status.results as any,
          error: status.error ?? null,
        },
      });
    } catch (error) {
      console.error('Error saving sync status to database:', error);
    }

    return results;
  } catch (error) {
    console.error('Error syncing segments:', error);
    throw error;
  }
}

/**
 * Get sync status from database
 */
export async function getSyncStatus(): Promise<SegmentSyncStatus> {
  try {
    const dbStatus = await prisma.segmentSyncStatus.findUnique({
      where: { id: SYNC_STATUS_ID },
    });
    
    if (!dbStatus) {
      return {
        isRunning: false,
        lastRun: undefined,
        nextRun: undefined,
      };
    }
    
    return {
      isRunning: dbStatus.isRunning,
      lastRun: dbStatus.lastRun ? dbStatus.lastRun.getTime() : undefined,
      nextRun: dbStatus.nextRun ? dbStatus.nextRun.getTime() : undefined,
      results: dbStatus.results
        ? (dbStatus.results as unknown as SegmentSyncResult[])
        : undefined,
      error: dbStatus.error ?? undefined,
      needsUpdate: dbStatus.needsUpdate ?? false,
      lastTriggered: dbStatus.lastTriggered ? dbStatus.lastTriggered.getTime() : undefined,
      triggerTopic: dbStatus.triggerTopic ?? undefined,
    };
  } catch (error) {
    console.error('Error reading sync status from database:', error);
    return {
      isRunning: false,
      lastRun: undefined,
      nextRun: undefined,
    };
  }
}

/**
 * Check if sync should run
 */
export async function shouldRunSync(): Promise<boolean> {
  const status = await getSyncStatus();
  
  if (status.isRunning) {
    return false;
  }

  if (!status.lastRun) {
    return true;
  }

  const timeSinceLastRun = Date.now() - status.lastRun;
  return timeSinceLastRun >= SYNC_INTERVAL;
}

