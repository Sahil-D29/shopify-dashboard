export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const resolved = searchParams.get('resolved');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (level) where.level = level;
    if (resolved === 'true') where.resolved = true;
    if (resolved === 'false') where.resolved = false;

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    // Severity distribution
    const [critical, errorCount, warning, info] = await Promise.all([
      prisma.errorLog.count({ where: { level: 'CRITICAL' } }),
      prisma.errorLog.count({ where: { level: 'ERROR' } }),
      prisma.errorLog.count({ where: { level: 'WARNING' } }),
      prisma.errorLog.count({ where: { level: 'INFO' } }),
    ]);

    const unresolvedCount = await prisma.errorLog.count({ where: { resolved: false } });

    return NextResponse.json({
      errors: errors.map(e => ({
        id: e.id,
        level: e.level,
        message: e.message,
        stack: e.stack,
        context: e.context,
        userId: e.userId,
        storeId: e.storeId,
        resolved: e.resolved,
        resolvedAt: e.resolvedAt,
        createdAt: e.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      distribution: { CRITICAL: critical, ERROR: errorCount, WARNING: warning, INFO: info },
      unresolved: unresolvedCount,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin error-logs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch error logs' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || !action) {
      return NextResponse.json({ error: 'ids (array) and action required' }, { status: 400 });
    }

    if (action === 'resolve') {
      await prisma.errorLog.updateMany({
        where: { id: { in: ids } },
        data: { resolved: true, resolvedAt: new Date() },
      });
    } else if (action === 'unresolve') {
      await prisma.errorLog.updateMany({
        where: { id: { in: ids } },
        data: { resolved: false, resolvedAt: null },
      });
    } else if (action === 'delete') {
      await prisma.errorLog.deleteMany({
        where: { id: { in: ids } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin error-logs PUT error:', error);
    return NextResponse.json({ error: 'Failed to update error logs' }, { status: 500 });
  }
}
