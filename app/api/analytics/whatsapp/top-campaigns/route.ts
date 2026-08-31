export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    let storeId = await getCurrentStoreId(request);

    if (!storeId) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          const userStore = await prisma.store.findFirst({
            where: { ownerId: session.user.id },
            select: { id: true },
          });
          if (userStore) storeId = userStore.id;
        }
      } catch { /* ignore auth fallback errors */ }
    }

    if (!storeId) {
      return NextResponse.json({ topCampaigns: [] });
    }

    const [campaigns, verifiedConversions] = await Promise.all([
      prisma.campaign.findMany({
        where: { storeId, totalSent: { gt: 0 } },
        select: {
          id: true,
          name: true,
          status: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalFailed: true,
          createdAt: true,
        },
      }),
      prisma.campaignLog.findMany({
        where: {
          campaign: { storeId },
          status: 'CONVERTED',
          metadata: { path: ['attribution', 'verified'], equals: true },
        },
        select: { campaignId: true, convertedAmount: true },
      }),
    ]);

    const attributionByCampaign = new Map<string, { conversions: number; revenue: number }>();
    for (const log of verifiedConversions) {
      const current = attributionByCampaign.get(log.campaignId) ?? { conversions: 0, revenue: 0 };
      current.conversions += 1;
      current.revenue += log.convertedAmount ?? 0;
      attributionByCampaign.set(log.campaignId, current);
    }

    const topCampaigns = campaigns.map(c => {
      const attribution = attributionByCampaign.get(c.id) ?? { conversions: 0, revenue: 0 };
      return ({
      id: c.id,
      name: c.name,
      status: c.status,
      totalSent: c.totalSent,
      totalDelivered: c.totalDelivered,
      totalRead: c.totalOpened,
      totalClicked: c.totalClicked,
      totalConverted: attribution.conversions,
      totalFailed: c.totalFailed,
      totalRevenue: attribution.revenue,
      readRate: c.totalDelivered > 0 ? Math.round((c.totalOpened / c.totalDelivered) * 1000) / 10 : 0,
      conversionRate: c.totalSent > 0 ? Math.round((attribution.conversions / c.totalSent) * 1000) / 10 : 0,
      createdAt: c.createdAt.toISOString(),
      });
    }).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);

    return NextResponse.json({ topCampaigns });
  } catch (error) {
    console.error('[WhatsApp Top Campaigns] Error:', error);
    return NextResponse.json({ topCampaigns: [] });
  }
}
