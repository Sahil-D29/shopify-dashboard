export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import {
  readStoreRegistry,
  createStore,
  getStoreStats,
} from '@/lib/store-registry';

// GET /api/admin/stores - List all stores
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');

    let stores = await readStoreRegistry();

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      stores = stores.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.shopDomain.toLowerCase().includes(searchLower) ||
          s.owner.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (status) {
      stores = stores.filter((s) => s.status === status);
    }

    // Filter by plan
    if (plan) {
      stores = stores.filter((s) => s.plan === plan);
    }

    // Get stats for each store
    const storesWithStats = await Promise.all(
      stores.map(async (store) => {
        const stats = await getStoreStats(store.id);
        return {
          ...store,
          usersCount: stats.usersCount,
          messagesCount: stats.messagesCount,
        };
      })
    );

    return NextResponse.json({
      stores: storesWithStats,
      total: storesWithStats.length,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Get stores error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

// POST /api/admin/stores - Create new store
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { name, shopDomain, owner, plan } = body;

    // Validation
    if (!name || !shopDomain || !owner) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = ['free', 'basic', 'pro'];
    if (plan && !validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Create store
    const store = await createStore({
      name,
      shopDomain,
      owner,
      plan: plan || 'free',
    });

    // Log action
    const adminSession = await requireAdmin(request);
    await import('@/lib/auth/admin-auth').then(({ logAdminAction }) =>
      logAdminAction(
        adminSession.userId,
        'store_created',
        { storeId: store.id, name: store.name },
        request.headers.get('x-forwarded-for') || null,
        'success'
      )
    );

    return NextResponse.json({
      success: true,
      store,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Create store error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

