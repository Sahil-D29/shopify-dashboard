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

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessTeam(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storeId = request.nextUrl.searchParams.get('storeId');
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 });
    }

    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        storeId,
        acceptedAt: null,
        expiresAt: { gte: new Date() },
      },
      include: {
        inviter: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const list = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      storeId: inv.storeId,
      role: inv.role.toLowerCase(),
      invitedBy: inv.invitedBy,
      inviter: inv.inviter,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      status: 'pending',
    }));

    return NextResponse.json({ success: true, invitations: list });
  } catch (error) {
    console.error('Invitations pending API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
