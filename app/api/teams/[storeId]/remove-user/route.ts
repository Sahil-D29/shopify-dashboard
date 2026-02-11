import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter, canManageTeam } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId: requestedStoreId } = await context.params;

    const userContext = await getUserContext(req);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentStoreId = await getCurrentStoreId(req);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || requestedStoreId);
    if (!storeFilter.allowAll && storeFilter.storeId && storeFilter.storeId !== requestedStoreId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    const storeId = storeFilter.allowAll ? requestedStoreId : (storeFilter.storeId || requestedStoreId);

    const canManage = await canManageTeam(userContext, storeId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the store owner or an admin can remove users' },
        { status: 403 }
      );
    }

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const { email } = body;
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId: user.id, storeId } },
    });
    if (!member) {
      await prisma.invitation.updateMany({
        where: {
          email: email.toLowerCase(),
          storeId,
          acceptedAt: null,
        },
        data: { expiresAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'Invitation cancelled' });
    }

    if (member.role === 'OWNER') {
      const isSuperAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(
        (userContext.role || '').toUpperCase().replace(/_/g, '')
      );
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Only a super admin can remove a store owner' },
          { status: 403 }
        );
      }
      const ownerCount = await prisma.storeMember.count({
        where: { storeId, role: 'OWNER', status: 'ACTIVE' },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner of the store' },
          { status: 400 }
        );
      }
    }

    await prisma.storeMember.delete({
      where: { userId_storeId: { userId: user.id, storeId } },
    });
    await prisma.invitation.updateMany({
      where: {
        email: email.toLowerCase(),
        storeId,
        acceptedAt: null,
      },
      data: { expiresAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'User removed successfully' });
  } catch (error) {
    console.error('[API] Error removing user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
