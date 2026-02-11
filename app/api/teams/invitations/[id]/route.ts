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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessTeam(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || invitation.storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== invitation.storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.invitation.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Invitation cancelled' });
  } catch (error) {
    console.error('Cancel invitation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
