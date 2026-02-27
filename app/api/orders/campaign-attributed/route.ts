export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const storeId = await getCurrentStoreId(request);
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
