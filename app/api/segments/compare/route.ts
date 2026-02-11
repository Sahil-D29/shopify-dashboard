import { NextRequest, NextResponse } from 'next/server';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { requireStoreAccess, filterByStoreId } from '@/lib/tenant/api-helpers';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/segments/compare?ids=seg1&ids=seg2&ids=seg3
 * Compare multiple segments
 */
export async function GET(request: NextRequest) {
  try {
    const storeId = await requireStoreAccess(request);
    const { searchParams } = new URL(request.url);
    const segmentIds = searchParams.getAll('ids');

    if (segmentIds.length < 2 || segmentIds.length > 3) {
      return NextResponse.json(
        { error: 'Please provide 2-3 segment IDs to compare' },
        { status: 400 }
      );
    }

    const rows = await prisma.segment.findMany({
      where: { storeId, id: { in: segmentIds } },
    });
    const selectedSegments = rows.map(row => {
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
    if (selectedSegments.length !== segmentIds.length) {
      return NextResponse.json(
        { error: 'One or more segments not found' },
        { status: 404 }
      );
    }

    // Fetch customers
    const client = getShopifyClient(request);
    let customers: ShopifyCustomer[] = [];
    try {
      customers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    } catch (error) {
      console.error('Error fetching customers for comparison:', error);
    }

    // Get customers for each segment
    const segmentCustomers = new Map<string, Set<string>>();
    selectedSegments.forEach(segment => {
      const customerSet = new Set<string>();
      
      if (segment.type === 'custom' && segment.customerIds) {
        segment.customerIds.forEach((id: string) => customerSet.add(id));
      } else {
        customers
          .filter(customer => matchesGroups(customer, segment.conditionGroups || []))
          .forEach(customer => customerSet.add(String(customer.id)));
      }
      
      segmentCustomers.set(segment.id, customerSet);
    });

    // Calculate segment stats
    const segmentStats = selectedSegments.map(segment => {
      const customerSet = segmentCustomers.get(segment.id) || new Set();
      const segmentCustomersList = customers.filter(c => 
        customerSet.has(String(c.id))
      );

      const totalRevenue = segmentCustomersList.reduce(
        (sum, c) => sum + (Number(c.total_spent) || 0),
        0
      );
      const totalOrders = segmentCustomersList.reduce(
        (sum, c) => sum + (Number(c.orders_count) || 0),
        0
      );
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        id: segment.id,
        name: segment.name,
        customerCount: customerSet.size,
        totalRevenue,
        averageOrderValue,
      };
    });

    // Calculate overlaps
    const overlaps: Array<{
      segment1: string;
      segment2: string;
      sharedCustomers: number;
      overlapPercentage: number;
    }> = [];

    for (let i = 0; i < selectedSegments.length; i++) {
      for (let j = i + 1; j < selectedSegments.length; j++) {
        const seg1 = selectedSegments[i];
        const seg2 = selectedSegments[j];
        const set1 = segmentCustomers.get(seg1.id) || new Set();
        const set2 = segmentCustomers.get(seg2.id) || new Set();
        
        // Find intersection
        const shared = new Set([...set1].filter(id => set2.has(id)));
        const sharedCount = shared.size;
        
        // Calculate overlap percentage (based on smaller segment)
        const smallerSize = Math.min(set1.size, set2.size);
        const overlapPercentage = smallerSize > 0
          ? (sharedCount / smallerSize) * 100
          : 0;

        overlaps.push({
          segment1: seg1.id,
          segment2: seg2.id,
          sharedCustomers: sharedCount,
          overlapPercentage,
        });
      }
    }

    // Calculate unique customers
    const uniqueCustomers = selectedSegments.map(segment => {
      const set = segmentCustomers.get(segment.id) || new Set();
      const otherSets = selectedSegments
        .filter(s => s.id !== segment.id)
        .map(s => segmentCustomers.get(s.id) || new Set());
      
      // Find customers only in this segment
      const unique = new Set([...set].filter(id => 
        !otherSets.some(otherSet => otherSet.has(id))
      ));

      return {
        segmentId: segment.id,
        uniqueCount: unique.size,
      };
    });

    // Find shared characteristics (simplified)
    const sharedCharacteristics: Array<{
      characteristic: string;
      segments: string[];
      value: string | number;
    }> = [];

    // Average order value comparison
    const avgAOVs = segmentStats.map(s => s.averageOrderValue);
    if (avgAOVs.every(v => Math.abs(v - avgAOVs[0]) < 10)) {
      sharedCharacteristics.push({
        characteristic: 'Similar Average Order Value',
        segments: segmentStats.map(s => s.id),
        value: `$${avgAOVs[0].toFixed(2)}`,
      });
    }

    // Customer count range
    const counts = segmentStats.map(s => s.customerCount);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    if (maxCount - minCount < maxCount * 0.2) {
      sharedCharacteristics.push({
        characteristic: 'Similar Customer Count',
        segments: segmentStats.map(s => s.id),
        value: `${minCount.toLocaleString()} - ${maxCount.toLocaleString()}`,
      });
    }

    const comparison = {
      segments: segmentStats,
      overlaps,
      uniqueCustomers,
      sharedCharacteristics,
    };

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('Error comparing segments:', error);
    return NextResponse.json(
      { error: 'Failed to compare segments' },
      { status: 500 }
    );
  }
}

