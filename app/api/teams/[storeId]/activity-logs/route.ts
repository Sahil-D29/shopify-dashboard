export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  return role.toUpperCase().replace(/_/g, '');
}

function canAccessTeam(role: string | undefined): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  return ['ADMIN', 'SUPERADMIN', 'MANAGER', 'OWNER', 'STOREOWNER'].includes(n);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessTeam(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storeId } = await context.params;
    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 100, 200);
    const logs = await prisma.activityLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    const list = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      storeId: log.storeId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
      user: log.user,
    }));

    return NextResponse.json({ success: true, activityLogs: list });
  } catch (error) {
    console.error('Activity logs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
