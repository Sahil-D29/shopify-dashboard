import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { matchesGroups } from '@/lib/segments/evaluator';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { NextRequest } from 'next/server';

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
}

const SYNC_STATUS_FILE = 'segment-sync-status.json';
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

    // Update segment with new stats
    const segments = readJsonFile<CustomerSegment>('segments.json');
    const segmentIndex = segments.findIndex(s => s.id === segment.id);
    
    if (segmentIndex !== -1) {
      segments[segmentIndex] = {
        ...segments[segmentIndex],
        customerCount: result.customerCount,
        totalRevenue: result.totalRevenue,
        averageOrderValue: result.averageOrderValue,
        lastCalculated: result.lastCalculated,
      };
      writeJsonFile('segments.json', segments);
    }

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
    // Load segments
    const segments = readJsonFile<CustomerSegment>('segments.json');
    
    // Filter out custom segments (they don't need evaluation)
    const dynamicSegments = segments.filter(s => s.type !== 'custom');
    
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
      dynamicSegments.map(segment => syncSegment(segment, customers))
    );

    // Update sync status
    const status: SegmentSyncStatus = {
      isRunning: false,
      lastRun: Date.now(),
      nextRun: Date.now() + SYNC_INTERVAL,
      results,
    };
    
    try {
      writeJsonFile(SYNC_STATUS_FILE, status);
    } catch (error) {
      console.error('Error saving sync status:', error);
    }

    return results;
  } catch (error) {
    console.error('Error syncing segments:', error);
    throw error;
  }
}

/**
 * Get sync status
 */
export function getSyncStatus(): SegmentSyncStatus {
  try {
    const status = readJsonFile<SegmentSyncStatus>(SYNC_STATUS_FILE);
    return status;
  } catch {
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
export function shouldRunSync(): boolean {
  const status = getSyncStatus();
  
  if (status.isRunning) {
    return false;
  }

  if (!status.lastRun) {
    return true;
  }

  const timeSinceLastRun = Date.now() - status.lastRun;
  return timeSinceLastRun >= SYNC_INTERVAL;
}

