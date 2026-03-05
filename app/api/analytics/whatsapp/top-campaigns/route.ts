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

    const campaigns = await prisma.campaign.findMany({
      where: {
        storeId,
        totalSent: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalConverted: true,
        totalFailed: true,
        totalRevenue: true,
        createdAt: true,
      },
      orderBy: { totalRevenue: 'desc' },
      take: 10,
    });

    const topCampaigns = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      totalSent: c.totalSent,
      totalDelivered: c.totalDelivered,
      totalRead: c.totalOpened,
      totalClicked: c.totalClicked,
      totalConverted: c.totalConverted,
      totalFailed: c.totalFailed,
      totalRevenue: c.totalRevenue,
      readRate: c.totalDelivered > 0 ? Math.round((c.totalOpened / c.totalDelivered) * 1000) / 10 : 0,
      conversionRate: c.totalSent > 0 ? Math.round((c.totalConverted / c.totalSent) * 1000) / 10 : 0,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ topCampaigns });
  } catch (error) {
    console.error('[WhatsApp Top Campaigns] Error:', error);
    return NextResponse.json({ topCampaigns: [] });
  }
}
