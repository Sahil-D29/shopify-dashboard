export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');

    const where: any = {};
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        store: { select: { storeName: true, shopifyDomain: true } },
        segment: { select: { name: true } },
        _count: { select: { logs: true, queueItems: true } },
      },
    });

    // Aggregate stats
    const totalCampaigns = await prisma.campaign.count();
    const activeCampaigns = await prisma.campaign.count({ where: { status: { in: ['RUNNING', 'SCHEDULED', 'QUEUED'] } } });
    const totalSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + c.totalDelivered, 0);

    return NextResponse.json({
      stats: {
        total: totalCampaigns,
        active: activeCampaigns,
        totalSent,
        totalDelivered,
        deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      },
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        storeName: c.store.storeName,
        storeId: c.storeId,
        segmentName: c.segment?.name || null,
        totalSent: c.totalSent,
        totalDelivered: c.totalDelivered,
        totalOpened: c.totalOpened,
        totalClicked: c.totalClicked,
        scheduledAt: c.scheduledAt,
        executedAt: c.executedAt,
        completedAt: c.completedAt,
        createdAt: c.createdAt,
        logCount: c._count.logs,
        queueCount: c._count.queueItems,
      })),
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin campaigns GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
