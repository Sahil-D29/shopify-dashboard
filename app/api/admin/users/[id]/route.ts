import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { findUserById, updateStoreUser, deleteStoreUser } from '@/lib/store-users';
import { prisma } from '@/lib/prisma';
import { UserStatus } from '@prisma/client';

function toAdminRole(role: string): 'admin' | 'manager' | 'builder' | 'viewer' {
  const r = (role || '').toUpperCase();
  if (r === 'OWNER') return 'admin';
  if (r === 'MANAGER') return 'manager';
  if (r === 'TEAM_MEMBER') return 'builder';
  return 'viewer';
}

// GET /api/admin/users/[id] - Get single user (legacy store-users or Prisma)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const storeId = request.nextUrl.searchParams.get('storeId');

    let user = await findUserById(id);
    if (user) {
      const { password, ...rest } = user;
      return NextResponse.json({ success: true, user: rest });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { id },
      include: {
        ownedStores: { select: { id: true, storeName: true } },
        storeMembers: { include: { store: { select: { id: true, storeName: true } } } },
      },
    });
    if (!prismaUser || prismaUser.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const status = prismaUser.status === 'ACTIVE' ? 'active' : 'inactive';
    let storeIdRes = storeId || '';
    let role: 'admin' | 'manager' | 'builder' | 'viewer' = 'viewer';
    if (storeId) {
      const owned = prismaUser.ownedStores.find((s) => s.id === storeId);
      if (owned) {
        storeIdRes = owned.id;
        role = 'admin';
      } else {
        const member = prismaUser.storeMembers.find((m) => m.storeId === storeId);
        if (member) {
          storeIdRes = member.storeId;
          role = toAdminRole(member.role);
        }
      }
    } else if (prismaUser.ownedStores.length > 0) {
      storeIdRes = prismaUser.ownedStores[0].id;
      role = 'admin';
    } else if (prismaUser.storeMembers.length > 0) {
      const m = prismaUser.storeMembers[0];
      storeIdRes = m.storeId;
      role = toAdminRole(m.role);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: prismaUser.id,
        name: prismaUser.name,
        email: prismaUser.email,
        phone: undefined,
        storeId: storeIdRes,
        role,
        status,
        createdAt: prismaUser.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

function adminRoleToStoreRole(role: string): 'OWNER' | 'MANAGER' | 'TEAM_MEMBER' | 'VIEWER' {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'OWNER';
  if (r === 'manager') return 'MANAGER';
  if (r === 'builder') return 'TEAM_MEMBER';
  return 'VIEWER';
}

// PATCH /api/admin/users/[id] - Update user (legacy store-users or Prisma)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    const body = await request.json();
    let { name, email, phone, role, status, password, storeId } = body;
    // Normalize role to lowercase so "Admin" from UI is accepted
    if (typeof role === 'string') role = role.toLowerCase().trim();

    const validRoles = ['admin', 'manager', 'builder', 'viewer'];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const validStatuses = ['active', 'inactive', 'deleted'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (password !== undefined && password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const legacyUser = await findUserById(id);
    if (legacyUser) {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (status !== undefined) updates.status = status;
      if (password !== undefined) updates.password = password;
      const updatedUser = await updateStoreUser(id, updates);
      const adminSession = await requireAdmin(request);
      await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
        logAdminAction(
          adminSession.userId,
          'user_updated',
          { userId: updatedUser.id, updates },
          request.headers.get('x-forwarded-for') || null,
          'success'
        )
      );
      const { password: _, ...rest } = updatedUser;
      return NextResponse.json({ success: true, user: rest });
    }

    // Prisma user path
    const prismaUser = await prisma.user.findUnique({
      where: { id },
      include: {
        ownedStores: { select: { id: true } },
        storeMembers: { select: { storeId: true, role: true } },
      },
    });
    if (!prismaUser || prismaUser.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userUpdate: { name?: string; email?: string; status?: UserStatus; passwordHash?: string } = {};
    if (name !== undefined) userUpdate.name = name;
    if (email !== undefined) userUpdate.email = email.toLowerCase();
    if (status !== undefined) userUpdate.status = status === 'active' ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    if (password !== undefined && password.length >= 8) {
      const bcrypt = await import('bcryptjs');
      userUpdate.passwordHash = await bcrypt.hash(password, 12);
    }
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdate,
      });
    }

    // Normalize storeId: empty string is not valid
    const storeIdTrimmed = typeof storeId === 'string' ? storeId.trim() : '';
    const storeIdFromBody = storeIdTrimmed.length > 0 ? storeIdTrimmed : undefined;
    const fallbackStoreId =
      prismaUser.storeMembers[0]?.storeId ?? prismaUser.ownedStores[0]?.id;

    // When updating role, require storeId in body so we update the correct row (no silent wrong-store update)
    if (role !== undefined) {
      if (!storeIdFromBody) {
        return NextResponse.json(
          { error: 'storeId is required to update role. Edit the user from the row for the correct store.' },
          { status: 400 }
        );
      }
    }
    const storeIdToUpdate = storeIdFromBody ?? fallbackStoreId;

    if (role !== undefined && !storeIdToUpdate) {
      return NextResponse.json(
        { error: 'storeId is required to update role for this user.' },
        { status: 400 }
      );
    }

    let roleActuallyWritten: string | null = null;
    if (storeIdToUpdate && role !== undefined) {
      const storeRole = adminRoleToStoreRole(role);
      const existingMember = await prisma.storeMember.findUnique({
        where: { userId_storeId: { userId: id, storeId: storeIdToUpdate } },
      });
      const isOwner = prismaUser.ownedStores.some((s) => s.id === storeIdToUpdate);

      if (existingMember) {
        const updateResult = await prisma.storeMember.update({
          where: { userId_storeId: { userId: id, storeId: storeIdToUpdate } },
          data: { role: storeRole },
        });
        roleActuallyWritten = updateResult.role;
      } else if (isOwner) {
        const upsertResult = await prisma.storeMember.upsert({
          where: { userId_storeId: { userId: id, storeId: storeIdToUpdate } },
          create: { userId: id, storeId: storeIdToUpdate, role: storeRole, status: 'ACTIVE' },
          update: { role: storeRole },
        });
        roleActuallyWritten = upsertResult.role;
      } else {
        return NextResponse.json(
          { error: 'User is not a member of this store. Cannot update role.' },
          { status: 400 }
        );
      }

      // Verify write: re-fetch and ensure role persisted
      const verify = await prisma.storeMember.findUnique({
        where: { userId_storeId: { userId: id, storeId: storeIdToUpdate } },
        select: { role: true },
      });
      if (!verify || verify.role !== storeRole) {
        console.error('[PATCH admin/users] Role write verification failed', {
          userId: id,
          storeId: storeIdToUpdate,
          expected: storeRole,
          got: verify?.role,
        });
        return NextResponse.json(
          { error: 'Role update could not be persisted. Please try again.' },
          { status: 500 }
        );
      }
      // Temp verification: role selected by super admin → saved in DB (used by getUserContext for auth)
      if (process.env.NODE_ENV === 'development') {
        console.log('[PATCH admin/users] Role persisted (used at runtime):', {
          userId: id,
          storeId: storeIdToUpdate,
          roleSelected: role,
          roleSavedInDb: verify.role,
        });
      }
    }

    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'user_updated',
        { userId: id, updates: body, roleWritten: roleActuallyWritten ?? undefined },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    const updated = await prisma.user.findUnique({
      where: { id },
      include: {
        ownedStores: { select: { id: true } },
        storeMembers: { select: { storeId: true, role: true } },
      },
    });
    if (!updated) {
      return NextResponse.json({ error: 'User not found after update' }, { status: 500 });
    }

    const firstStoreId = updated.ownedStores[0]?.id ?? updated.storeMembers[0]?.storeId;
    const effectiveStoreId = storeIdToUpdate || firstStoreId || '';
    const memberForResponse = updated.storeMembers.find((m) => m.storeId === effectiveStoreId);
    const isOwnerOfStore = updated.ownedStores.some((s) => s.id === effectiveStoreId);
    const roleRes =
      memberForResponse !== undefined
        ? toAdminRole(memberForResponse.role)
        : isOwnerOfStore
          ? 'admin'
          : 'viewer';

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        storeId: effectiveStoreId,
        role: roleRes,
        status: updated.status === 'ACTIVE' ? 'active' : 'inactive',
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting last admin in a store
    if (user.role === 'admin') {
      const { readStoreUsers } = await import('@/lib/store-users');
      const storeUsers = await readStoreUsers(user.storeId);
      const adminUsers = storeUsers.filter(
        (u) => u.role === 'admin' && u.status !== 'deleted'
      );
      
      if (adminUsers.length === 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user in a store' },
          { status: 400 }
        );
      }
    }

    await deleteStoreUser(id);

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'user_deleted',
        { userId: id, email: user.email },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

