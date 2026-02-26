export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toTwoDecimal = (value: number): number =>
  Math.round(value * 100) / 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const storeId = await getCurrentStoreId(request);

    // Load campaign from Prisma
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, storeId: storeId || undefined },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Aggregate message stats from CampaignLog
    const logStats = await prisma.campaignLog.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    for (const row of logStats) {
      statusCounts[row.status] = row._count;
    }

    const toSend = campaign.estimatedReach ?? 0;
    const sent = (statusCounts['SUCCESS'] ?? 0) + (statusCounts['DELIVERED'] ?? 0) + (statusCounts['READ'] ?? 0);
    const delivered = (statusCounts['DELIVERED'] ?? 0) + (statusCounts['READ'] ?? 0);
    const read = statusCounts['READ'] ?? 0;
    const failed = statusCounts['FAILED'] ?? 0;

    // Also factor in campaign-level metrics for backward compat
    const totalSent = Math.max(sent, campaign.totalSent ?? 0);
    const totalDelivered = Math.max(delivered, campaign.totalDelivered ?? 0);
    const totalFailed = Math.max(failed, campaign.totalFailed ?? 0);

    const sentRate = toSend > 0 ? (totalSent / toSend) * 100 : 0;
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const readRate = totalDelivered > 0 ? (read / totalDelivered) * 100 : 0;

    return NextResponse.json({
      toSend,
      sent: totalSent,
      delivered: totalDelivered,
      read,
      failed: totalFailed,
      sentRate: toTwoDecimal(sentRate),
      deliveryRate: toTwoDecimal(deliveryRate),
      readRate: toTwoDecimal(readRate),
    });
  } catch (error) {
    console.error('[API] Error fetching message stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message stats', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
