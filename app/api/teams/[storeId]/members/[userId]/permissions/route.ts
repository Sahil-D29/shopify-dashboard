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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storeId: string; userId: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessTeam(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storeId, userId } = await context.params;
    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { permissions } = body as { permissions?: unknown };

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (!member) {
      return NextResponse.json({ success: false, error: 'Team member not found' }, { status: 404 });
    }

    await prisma.storeMember.update({
      where: { userId_storeId: { userId, storeId } },
      data: { permissions: permissions !== undefined ? (permissions as object) : undefined },
    });

    return NextResponse.json({
      success: true,
      teamMember: { userId, storeId, permissions: permissions ?? [] },
    });
  } catch (error) {
    console.error('Update permissions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
