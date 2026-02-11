export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { calculateSegmentStats } from '@/lib/utils/segment-stats';
import type { SegmentGroup } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

interface SegmentPreviewFilters {
  operator?: 'AND' | 'OR';
  conditions: SegmentGroup['conditions'];
}

interface SegmentPreviewRequest {
  conditionGroups?: SegmentGroup[];
  filters?: SegmentPreviewFilters;
  forceRefresh?: boolean;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as SegmentPreviewRequest;

    let conditionGroups: SegmentGroup[] = Array.isArray(body.conditionGroups) ? body.conditionGroups : [];

    if (!conditionGroups.length && body.filters?.conditions) {
      const filters = body.filters;
      conditionGroups = [
        {
          id: 'preview-group',
          groupOperator: filters.operator ?? 'AND',
          conditions: filters.conditions,
        },
      ];
    }

    const client = getShopifyClient(request);

    const stats = await calculateSegmentStats({
      client,
      conditionGroups,
      sampleLimit: 5,
      forceRefresh: body.forceRefresh ?? true,
    });

    const customers = (stats.customers ?? []) as ShopifyCustomer[];

    return NextResponse.json({
      customerCount: stats.customerCount,
      totalValue: stats.totalValue,
      avgOrderValue: stats.avgOrderValue,
      lastUpdated: stats.lastUpdated,
      sampleCustomers: customers.map(customer => ({
        id: customer.id,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email,
        totalSpent: customer.total_spent,
        ordersCount: customer.orders_count,
      })),
    });
  } catch (error) {
    console.error('[Segments][Preview] Error computing preview:', error);
    return NextResponse.json(
      { error: 'Failed to preview segment', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

