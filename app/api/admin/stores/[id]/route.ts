import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import {
  findStoreById,
  updateStore,
  deleteStore,
  getStoreStats,
} from '@/lib/store-registry';
import { readStoreUsers } from '@/lib/store-users';

// GET /api/admin/stores/[id] - Get store details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    const store = await findStoreById(id);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get store statistics
    const stats = await getStoreStats(id);
    const users = await readStoreUsers(id);

    return NextResponse.json({
      success: true,
      store: {
        ...store,
        ...stats,
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
        })),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Get store error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// PATCH /api/admin/stores/[id] - Update store
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    const body = await request.json();
    const { name, shopDomain, owner, status, plan } = body;

    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (shopDomain !== undefined) updates.shopDomain = shopDomain;
    if (owner !== undefined) updates.owner = owner;
    if (status !== undefined) {
      const validStatuses = ['active', 'suspended', 'inactive'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = status;
    }
    if (plan !== undefined) {
      const validPlans = ['free', 'basic', 'pro'];
      if (!validPlans.includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }
      updates.plan = plan;
    }

    const updatedStore = await updateStore(id, updates);

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'store_updated',
        { storeId: updatedStore.id, updates },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      store: updatedStore,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error.message === 'Store not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Update store error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// DELETE /api/admin/stores/[id] - Delete store
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;

    const store = await findStoreById(id);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    await deleteStore(id);

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'store_deleted',
        { storeId: id, name: store.name },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      message: 'Store deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Delete store error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

