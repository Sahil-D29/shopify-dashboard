export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({
        totalCampaigns: 0,
        totalMessagesSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalConverted: 0,
        campaignRevenue: 0,
        deliveryRate: 0,
        readRate: 0,
        conversionRate: 0,
      });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { storeId },
      select: {
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalConverted: true,
        totalRevenue: true,
      },
    });

    const totalCampaigns = campaigns.length;
    const totalMessagesSent = campaigns.reduce((sum, c) => sum + (c.totalSent ?? 0), 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + (c.totalDelivered ?? 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.totalOpened ?? 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.totalClicked ?? 0), 0);
    const totalConverted = campaigns.reduce((sum, c) => sum + (c.totalConverted ?? 0), 0);
    const campaignRevenue = campaigns.reduce((sum, c) => sum + (c.totalRevenue ?? 0), 0);

    const deliveryRate = totalMessagesSent > 0 ? (totalDelivered / totalMessagesSent) * 100 : 0;
    const readRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const conversionRate = totalMessagesSent > 0 ? (totalConverted / totalMessagesSent) * 100 : 0;

    return NextResponse.json({
      totalCampaigns,
      totalMessagesSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalConverted,
      campaignRevenue,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      readRate: Math.round(readRate * 10) / 10,
      conversionRate: Math.round(conversionRate * 10) / 10,
    });
  } catch (error) {
    console.error('[Campaign Analytics] Error:', error);
    return NextResponse.json({
      totalCampaigns: 0,
      totalMessagesSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalConverted: 0,
      campaignRevenue: 0,
      deliveryRate: 0,
      readRate: 0,
      conversionRate: 0,
    });
  }
}
