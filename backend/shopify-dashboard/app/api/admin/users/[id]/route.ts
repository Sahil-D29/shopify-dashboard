import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { findUserById, updateStoreUser, deleteStoreUser } from '@/lib/store-users';

// GET /api/admin/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const user = await findUserById(params.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Get user error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { name, email, phone, role, status, password } = body;

    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) {
      const validRoles = ['admin', 'manager', 'builder', 'viewer'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updates.role = role;
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'deleted'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = status;
    }
    if (password !== undefined) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      updates.password = password;
    }

    const updatedUser = await updateStoreUser(params.id, updates);

    // Log action
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
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
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const user = await findUserById(params.id);
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

    await deleteStoreUser(params.id);

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'user_deleted',
        { userId: params.id, email: user.email },
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

