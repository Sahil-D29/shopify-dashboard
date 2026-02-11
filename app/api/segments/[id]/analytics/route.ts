export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { requireStoreAccess, filterByStoreId } from '@/lib/tenant/api-helpers';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

/**
 * GET /api/segments/[id]/analytics
 * Get analytics for a specific segment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const storeId = await requireStoreAccess(request);
    const { id: segmentId } = await params;

    const row = await prisma.segment.findFirst({
      where: { id: segmentId, storeId },
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
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Fetch customers
    const client = getShopifyClient(request);
    let customers: ShopifyCustomer[] = [];
    try {
      customers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    } catch (error) {
      console.error('Error fetching customers for analytics:', error);
    }

    // Filter customers by segment
    let matchingCustomers: ShopifyCustomer[];
    if (segment.type === 'custom' && segment.customerIds) {
      matchingCustomers = customers.filter(c => 
        segment.customerIds?.includes(String(c.id))
      );
    } else {
      matchingCustomers = customers.filter(customer =>
        matchesGroups(customer, segment.conditionGroups || [])
      );
    }

    // Calculate analytics
    const totalRevenue = matchingCustomers.reduce(
      (sum, c) => sum + (Number(c.total_spent) || 0),
      0
    );
    const totalOrders = matchingCustomers.reduce(
      (sum, c) => sum + (Number(c.orders_count) || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top locations
    const locationMap = new Map<string, number>();
    matchingCustomers.forEach(customer => {
      const address = customer.addresses?.[0];
      if (address) {
        const location = `${address.city || 'Unknown'}, ${address.country || 'Unknown'}`;
        locationMap.set(location, (locationMap.get(location) || 0) + 1);
      }
    });
    const topLocations = Array.from(locationMap.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Customer distribution (by order count)
    const distributionMap = new Map<string, number>();
    matchingCustomers.forEach(customer => {
      const orders = Number(customer.orders_count || 0);
      let label = 'No orders';
      if (orders >= 10) label = '10+ orders';
      else if (orders >= 5) label = '5-9 orders';
      else if (orders >= 2) label = '2-4 orders';
      else if (orders === 1) label = '1 order';
      distributionMap.set(label, (distributionMap.get(label) || 0) + 1);
    });
    const customerDistribution = Array.from(distributionMap.entries())
      .map(([label, value]) => ({ label, value }));

    // Revenue trend (last 6 months, simplified)
    const revenueTrend = [];
    const now = Date.now();
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      // Simplified: use total revenue / 6 for each month
      const monthlyRevenue = totalRevenue / 6;
      revenueTrend.push({
        date: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthlyRevenue,
      });
    }

    // Engagement rate (customers with orders)
    const engagedCustomers = matchingCustomers.filter(c => 
      Number(c.orders_count || 0) > 0
    ).length;
    const engagementRate = matchingCustomers.length > 0
      ? (engagedCustomers / matchingCustomers.length) * 100
      : 0;

    // Growth trend (simplified: 5% for demo)
    const growthTrend = 5.0;

    const analytics = {
      customerCount: matchingCustomers.length,
      totalRevenue,
      averageOrderValue,
      topLocations,
      customerDistribution,
      revenueTrend,
      engagementRate,
      growthTrend,
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Error calculating segment analytics:', error);
    return NextResponse.json(
      { error: 'Failed to calculate analytics' },
      { status: 500 }
    );
  }
}
