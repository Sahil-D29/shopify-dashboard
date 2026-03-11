export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/prisma';

// GET — List all stores a user belongs to
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: userId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get stores where user is owner
    const ownedStores = await prisma.store.findMany({
      where: { ownerId: userId },
      select: { id: true, storeName: true, shopifyDomain: true, isActive: true, installedAt: true },
    });

    // Get stores where user is a member (via StoreMember)
    const memberships = await prisma.storeMember.findMany({
      where: { userId },
      include: {
        store: {
          select: { id: true, storeName: true, shopifyDomain: true, isActive: true, installedAt: true },
        },
      },
    });

    // Combine into a unified list
    const storeMap = new Map<string, any>();

    for (const store of ownedStores) {
      storeMap.set(store.id, {
        storeId: store.id,
        storeName: store.storeName,
        shopifyDomain: store.shopifyDomain,
        isActive: store.isActive,
        installedAt: store.installedAt?.toISOString(),
        role: 'OWNER',
        isOwner: true,
        membershipStatus: 'ACTIVE',
      });
    }

    for (const m of memberships) {
      if (storeMap.has(m.storeId)) {
        // Already listed as owner, update role from membership if different
        const existing = storeMap.get(m.storeId);
        existing.membershipRole = m.role;
        existing.membershipStatus = m.status;
      } else {
        storeMap.set(m.storeId, {
          storeId: m.storeId,
          storeName: m.store.storeName,
          shopifyDomain: m.store.shopifyDomain,
          isActive: m.store.isActive,
          installedAt: m.store.installedAt?.toISOString(),
          role: m.role,
          isOwner: false,
          membershipStatus: m.status,
        });
      }
    }

    return NextResponse.json({
      userId,
      userName: user.name,
      userEmail: user.email,
      stores: Array.from(storeMap.values()),
      total: storeMap.size,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching user stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Assign user to a new store
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: userId } = await context.params;
    const body = await req.json();
    const { storeId, role = 'TEAM_MEMBER' } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    const validRoles = ['OWNER', 'MANAGER', 'TEAM_MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    const [user, store] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      prisma.store.findUnique({ where: { id: storeId }, select: { id: true, storeName: true } }),
    ]);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const existing = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already assigned to this store' }, { status: 409 });
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

    await logAdminAction(admin.userId, 'user_assigned_to_store', {
      userId, storeId, role, userEmail: user.email, storeName: store.storeName,
    }, req.headers.get('x-forwarded-for'));

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error assigning user to store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove user from a store
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: userId } = await context.params;
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'storeId query param is required' }, { status: 400 });
    }

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
      include: {
        user: { select: { email: true } },
        store: { select: { storeName: true } },
      },
    });
    if (!member) {
      return NextResponse.json({ error: 'User is not a member of this store' }, { status: 404 });
    }

    await prisma.storeMember.delete({
      where: { userId_storeId: { userId, storeId } },
    });

    await logAdminAction(admin.userId, 'user_removed_from_store', {
      userId, storeId, role: member.role,
      userEmail: member.user?.email, storeName: member.store?.storeName,
    }, req.headers.get('x-forwarded-for'));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error removing user from store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
