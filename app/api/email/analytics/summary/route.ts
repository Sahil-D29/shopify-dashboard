export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const VALID_RANGES: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const rangeParam = request.nextUrl.searchParams.get('range') ?? '30d';
    const days = VALID_RANGES[rangeParam] ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const baseStoreWhere: any = storeFilter.allowAll
      ? {}
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId }
        : { storeId: '__none__' };

    const campaignWhere = { ...baseStoreWhere };
    const eventWhere = { ...baseStoreWhere, occurredAt: { gte: since } };

    const [campaigns, totals, eventBuckets, topCampaigns] = await Promise.all([
      prisma.emailCampaign.count({
        where: { ...campaignWhere, status: 'COMPLETED' },
      }),
      prisma.emailCampaign.aggregate({
        where: { ...campaignWhere, status: 'COMPLETED' },
        _sum: {
          sentCount: true,
          deliveredCount: true,
          openedCount: true,
          clickedCount: true,
          bouncedCount: true,
          complainedCount: true,
          failedCount: true,
        },
      }),
      prisma.emailEvent.groupBy({
        by: ['type'],
        where: eventWhere,
        _count: { _all: true },
      }),
      prisma.emailCampaign.findMany({
        where: { ...campaignWhere, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          subject: true,
          completedAt: true,
          sentCount: true,
          openedCount: true,
          clickedCount: true,
          bouncedCount: true,
        },
      }),
    ]);

    // Daily timeseries: count events per day per type
    // Postgres truncation via raw query (we use a parameterized $queryRaw)
    let timeseries: Array<{ day: string; type: string; count: number }> = [];
    try {
      const storeCondition = storeFilter.allowAll
        ? '1=1'
        : storeFilter.storeId
          ? `"storeId" = $1`
          : '1=0';
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT
            to_char(date_trunc('day', "occurredAt"), 'YYYY-MM-DD') as day,
            "type" as type,
            COUNT(*)::int as count
         FROM "email_events"
         WHERE ${storeCondition} AND "occurredAt" >= $${storeFilter.allowAll ? 1 : 2}
         GROUP BY 1, 2
         ORDER BY 1 ASC`,
        ...(storeFilter.allowAll ? [since] : [storeFilter.storeId, since]),
      )) as Array<{ day: string; type: string; count: number | bigint }>;
      timeseries = rows.map(r => ({
        day: r.day,
        type: r.type,
        count: typeof r.count === 'bigint' ? Number(r.count) : r.count,
      }));
    } catch (error) {
      console.warn('[Analytics] timeseries query failed:', getErrorMessage(error));
    }

    const counts: Record<string, number> = {};
    for (const row of eventBuckets) {
      counts[row.type] = row._count._all;
    }

    const sums = totals._sum;
    const totalSent = sums.sentCount ?? 0;
    const totalDelivered = sums.deliveredCount ?? 0;
    const totalOpened = sums.openedCount ?? 0;
    const totalClicked = sums.clickedCount ?? 0;
    const totalBounced = sums.bouncedCount ?? 0;
    const totalComplained = sums.complainedCount ?? 0;
    const totalFailed = sums.failedCount ?? 0;

    return NextResponse.json({
      success: true,
      range: { days, since: since.toISOString() },
      totals: {
        campaigns,
        sent: totalSent,
        delivered: totalDelivered,
        opened: totalOpened,
        clicked: totalClicked,
        bounced: totalBounced,
        complained: totalComplained,
        failed: totalFailed,
      },
      rates: {
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
        complaintRate: totalSent > 0 ? (totalComplained / totalSent) * 100 : 0,
        deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      },
      eventCounts: counts,
      topCampaigns,
      timeseries,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load analytics',
        details: getErrorMessage(error),
      },
      { status: 200 },
    );
  }
}
