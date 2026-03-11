export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/prisma';

// GET — List all members of a store
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: storeId } = await context.params;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, storeName: true, ownerId: true },
    });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const members = await prisma.storeMember.findMany({
      where: { storeId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, status: true, lastLogin: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return NextResponse.json({
      storeId,
      storeName: store.storeName,
      ownerId: store.ownerId,
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        storeId: m.storeId,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt?.toISOString(),
        user: m.user ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          globalRole: m.user.role,
          status: m.user.status,
          lastLogin: m.user.lastLogin?.toISOString(),
        } : null,
      })),
      total: members.length,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching store members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Add an existing user to a store
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: storeId } = await context.params;
    const body = await req.json();
    const { userId, role = 'TEAM_MEMBER' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const validRoles = ['OWNER', 'MANAGER', 'TEAM_MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    // Verify store and user exist
    const [store, user] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { id: true, storeName: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    ]);
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check if already a member
    const existing = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this store' }, { status: 409 });
    }

    const member = await prisma.storeMember.create({
      data: {
        userId,
        storeId,
        role: role as any,
        status: 'ACTIVE',
        invitedBy: admin.userId,
      },
    });

    await logAdminAction(admin.userId, 'store_member_added', {
      storeId, userId, role, userEmail: user.email, storeName: store.storeName,
    }, req.headers.get('x-forwarded-for'));

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error adding store member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Change a member's role
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: storeId } = await context.params;
    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    const validRoles = ['OWNER', 'MANAGER', 'TEAM_MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (!member) {
      return NextResponse.json({ error: 'User is not a member of this store' }, { status: 404 });
    }

    const updated = await prisma.storeMember.update({
      where: { userId_storeId: { userId, storeId } },
      data: { role: role as any },
    });

    await logAdminAction(admin.userId, 'store_member_role_changed', {
      storeId, userId, oldRole: member.role, newRole: role,
    }, req.headers.get('x-forwarded-for'));

    return NextResponse.json({ success: true, member: updated });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating store member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a user from a store
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: storeId } = await context.params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
    }

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
      include: { user: { select: { email: true } } },
    });
    if (!member) {
      return NextResponse.json({ error: 'User is not a member of this store' }, { status: 404 });
    }

    await prisma.storeMember.delete({
      where: { userId_storeId: { userId, storeId } },
    });

    await logAdminAction(admin.userId, 'store_member_removed', {
      storeId, userId, role: member.role, userEmail: member.user?.email,
    }, req.headers.get('x-forwarded-for'));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error removing store member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
