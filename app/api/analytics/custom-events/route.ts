export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const eventNameFilter = searchParams.get('eventName');

    // Calculate date range
    const now = new Date();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[period] || 30;
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Build filter
    const where: Record<string, unknown> = {
      storeId,
      eventType: eventNameFilter
        ? `custom:${eventNameFilter}`
        : { startsWith: 'custom:' },
      createdAt: { gte: fromDate },
    };

    // Get event counts by type
    const eventCounts = await prisma.storefrontEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Get total count
    const totalEvents = await prisma.storefrontEvent.count({ where });

    // Get event definitions for display names
    const definitions = await prisma.customEventDefinition.findMany({
      where: { storeId },
      select: { eventName: true, displayName: true, eventCount: true, lastSeenAt: true },
    });

    const defMap = new Map(definitions.map((d) => [`custom:${d.eventName}`, d]));

    const topEvents = eventCounts.map((ec) => ({
      eventType: ec.eventType,
      eventName: ec.eventType.replace('custom:', ''),
      displayName: defMap.get(ec.eventType)?.displayName || ec.eventType.replace('custom:', ''),
      count: ec._count.id,
    }));

    // Get daily trend data
    const dailyEvents = await prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM storefront_events
       WHERE store_id = $1
         AND event_type LIKE 'custom:%'
         AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      storeId,
      fromDate
    );

    const trend = dailyEvents.map((d) => ({
      date: d.date,
      count: Number(d.count),
    }));

    return NextResponse.json({
      success: true,
      analytics: {
        totalEvents,
        topEvents,
        trend,
        period,
        definitions: definitions.map((d) => ({
          eventName: d.eventName,
          displayName: d.displayName,
          totalCount: d.eventCount,
          lastSeenAt: d.lastSeenAt,
        })),
      },
    });
  } catch (error) {
    console.error('[Custom Events Analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
