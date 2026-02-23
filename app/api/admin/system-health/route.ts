export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch system health records
    const healthRecords = await prisma.systemHealth.findMany({
      orderBy: { lastUpdated: 'desc' },
      take: 10,
    });

    // Fetch error counts by severity in last 24h
    const recentErrors = await prisma.errorLog.findMany({
      where: { createdAt: { gte: last24h } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const errorCounts = {
      CRITICAL: recentErrors.filter(e => e.level === 'CRITICAL').length,
      ERROR: recentErrors.filter(e => e.level === 'ERROR').length,
      WARNING: recentErrors.filter(e => e.level === 'WARNING').length,
      INFO: recentErrors.filter(e => e.level === 'INFO').length,
    };

    // Get total error count in last 7 days
    const weekErrors = await prisma.errorLog.count({
      where: { createdAt: { gte: last7d } },
    });

    // Active users (logged in within 24h)
    const activeUsers = await prisma.user.count({
      where: { lastLogin: { gte: last24h } },
    });

    // Total stores
    const totalStores = await prisma.store.count({ where: { isActive: true } });

    // Active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });

    // Queue status
    const queuePending = await prisma.campaignQueueItem.count({ where: { status: 'PENDING' } });
    const queueProcessing = await prisma.campaignQueueItem.count({ where: { status: 'PROCESSING' } });
    const queueFailed = await prisma.campaignQueueItem.count({ where: { status: 'FAILED' } });

    // Determine overall status
    let overallStatus = 'HEALTHY';
    if (errorCounts.CRITICAL > 0) overallStatus = 'DOWN';
    else if (errorCounts.ERROR > 5 || queueFailed > 10) overallStatus = 'DEGRADED';

    const latestHealth = healthRecords[0] || null;

    return NextResponse.json({
      overallStatus,
      metrics: {
        activeUsers,
        totalStores,
        activeSubscriptions,
        errors24h: recentErrors.length,
        errors7d: weekErrors,
        errorCounts,
      },
      queue: {
        pending: queuePending,
        processing: queueProcessing,
        failed: queueFailed,
      },
      services: {
        database: { status: 'HEALTHY', message: 'Connected' },
        campaignWorker: { status: latestHealth?.campaignWorkerStatus || 'UNKNOWN' },
        journeyWorker: { status: latestHealth?.journeyWorkerStatus || 'UNKNOWN' },
        shopifyToken: { status: latestHealth?.shopifyTokenValid ? 'HEALTHY' : 'WARNING', lastCheck: latestHealth?.shopifyLastTokenCheck },
      },
      recentErrors: recentErrors.slice(0, 10).map(e => ({
        id: e.id,
        level: e.level,
        message: e.message,
        context: e.context,
        resolved: e.resolved,
        createdAt: e.createdAt,
      })),
      serverUptime: latestHealth?.serverUptimeSeconds || 0,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('System health GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch system health' }, { status: 500 });
  }
}
