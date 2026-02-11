import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/logger';
import { StoreRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

function mapRoleToStoreRole(role: string): StoreRole {
  const r = (role || '').toLowerCase();
  if (r === 'manager') return 'MANAGER';
  if (r === 'team_member' || r === 'team member') return 'TEAM_MEMBER';
  if (r === 'viewer') return 'VIEWER';
  if (r === 'store_owner' || r === 'owner') return 'OWNER';
  return 'VIEWER';
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const userContext = await getUserContext(req);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in' }, { status: 401 });
    }

    const { storeId } = await context.params;
    const { canManageTeam } = await import('@/lib/user-context');
    const canManage = await canManageTeam(userContext, storeId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the store owner or an admin can invite users' },
        { status: 403 }
      );
    }
    const currentStoreId = await getCurrentStoreId(req);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden', message: 'No access to this store' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role, permissions } = body as { email?: string; role?: string; permissions?: unknown };
    if (!email || !role) {
      return NextResponse.json({ success: false, error: 'Email and role are required' }, { status: 400 });
    }

    const validRoles = ['manager', 'team_member', 'viewer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return NextResponse.json({ success: false, error: `Invalid role. Allowed: ${validRoles.join(', ')}` }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingUser) {
      const member = await prisma.storeMember.findUnique({
        where: { userId_storeId: { userId: existingUser.id, storeId } },
      });
      if (member) {
        return NextResponse.json({ success: false, error: 'User is already a team member' }, { status: 409 });
      }
    }

    const pending = await prisma.invitation.findMany({
      where: { storeId, acceptedAt: null, expiresAt: { gte: new Date() } },
    });
    if (pending.some((i) => i.email.toLowerCase() === email.toLowerCase().trim())) {
      return NextResponse.json({ success: false, error: 'An invitation is already pending for this email' }, { status: 409 });
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        storeId,
        email: email.toLowerCase().trim(),
        role: mapRoleToStoreRole(role),
        invitedBy: userContext.userId,
        token,
        expiresAt,
      },
      include: { inviter: { select: { email: true, name: true } } },
    });

    await logActivity({
      userId: userContext.userId,
      storeId,
      action: 'user_invited',
      resourceId: invitation.id,
      details: { invitedEmail: email, role, invitationId: invitation.id },
    });

    const baseUrl = getBaseUrl();
    const invitationLink = `${baseUrl}/accept-invitation?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        storeId: invitation.storeId,
        role: invitation.role.toLowerCase(),
        permissions: permissions ?? [],
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        status: 'pending',
        token: invitation.token,
      },
      invitationLink,
    });
  } catch (error) {
    console.error('Invite API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
