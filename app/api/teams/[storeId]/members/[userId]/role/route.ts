export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter, canManageTeam } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { StoreRole } from '@prisma/client';

function mapRoleToStoreRole(role: string): StoreRole {
  const r = (role || '').toLowerCase();
  if (r === 'manager') return 'MANAGER';
  if (r === 'team_member' || r === 'team member') return 'TEAM_MEMBER';
  if (r === 'viewer') return 'VIEWER';
  return 'VIEWER';
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

    const { storeId, userId } = await context.params;
    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canManage = await canManageTeam(userContext, storeId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the store owner or an admin can change roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role: newRole } = body as { role?: string };
    if (!newRole) {
      return NextResponse.json({ success: false, error: 'Role is required' }, { status: 400 });
    }
    const validRoles = ['manager', 'team_member', 'viewer'];
    if (!validRoles.includes(newRole.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Allowed: ${validRoles.join(', ')} (owner cannot be assigned via this API)` },
        { status: 400 }
      );
    }

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (!member) {
      return NextResponse.json({ success: false, error: 'Team member not found' }, { status: 404 });
    }

    if (member.role === 'OWNER') {
      const isSuperAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(
        (userContext.role || '').toUpperCase().replace(/_/g, '')
      );
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: "Only a super admin can change a store owner's role" },
          { status: 403 }
        );
      }
    }

    const storeRole = mapRoleToStoreRole(newRole);
    await prisma.storeMember.update({
      where: { userId_storeId: { userId, storeId } },
      data: { role: storeRole },
    });

    return NextResponse.json({
      success: true,
      teamMember: { userId, storeId, role: newRole.toLowerCase() },
    });
  } catch (error) {
    console.error('Update role API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
