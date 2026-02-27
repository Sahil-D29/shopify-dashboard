export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    let storeId = await getCurrentStoreId(request);

    // Fallback: look up user's own store
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
      } catch { /* ignore */ }
    }

    if (!storeId) {
      return NextResponse.json({ attributedOrders: [] });
    }

    // Find all campaign logs that have a convertedOrderId (i.e. campaign-attributed orders)
    const logs = await prisma.campaignLog.findMany({
      where: {
        campaign: { storeId },
        convertedOrderId: { not: null },
      },
      select: {
        convertedOrderId: true,
        convertedAmount: true,
        convertedAt: true,
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { convertedAt: 'desc' },
    });

    // Build a map of orderId -> campaign info
    const attributedOrders = logs.map(log => ({
      convertedOrderId: log.convertedOrderId,
      convertedAmount: log.convertedAmount,
      convertedAt: log.convertedAt,
      campaignId: log.campaign.id,
      campaignName: log.campaign.name,
    }));

    return NextResponse.json({ attributedOrders });
  } catch (error) {
    console.error('[Campaign Attributed Orders] Error:', error);
    return NextResponse.json({ attributedOrders: [] });
  }
}
