import { NextResponse } from 'next/server';
import { readStoreRegistry } from '@/lib/store-registry';
import { auth } from '@/lib/auth';

/**
 * GET /api/stores
 * Get all stores that the current user has access to
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all stores from registry
    const stores = await readStoreRegistry();

    // Filter stores based on user access
    // For now, return all active stores
    // Later, can filter by user's store access list
    const accessibleStores = stores.filter(store => store.status === 'active');

    return NextResponse.json({
      stores: accessibleStores,
      total: accessibleStores.length,
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores
 * Create a new store (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin
    // For now, allow any authenticated user

    const body = await request.json();
    const { name, shopDomain, owner, plan = 'basic' } = body;

    if (!name || !shopDomain || !owner) {
      return NextResponse.json(
        { error: 'Missing required fields: name, shopDomain, owner' },
        { status: 400 }
      );
    }

    // Validate shop domain format
    if (!shopDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return NextResponse.json(
        { error: 'Invalid shop domain format' },
        { status: 400 }
      );
    }

    const { writeStoreRegistry } = await import('@/lib/store-registry');
    const stores = await readStoreRegistry();

    // Check if store already exists
    const existingStore = stores.find(
      s => s.shopDomain === shopDomain || s.id === `store_${shopDomain.replace('.myshopify.com', '')}`
    );

    if (existingStore) {
      return NextResponse.json(
        { error: 'Store already exists' },
        { status: 409 }
      );
    }

    // Create new store
    const newStore = {
      id: `store_${shopDomain.replace('.myshopify.com', '').replace(/[^a-zA-Z0-9]/g, '_')}`,
      name,
      shopDomain,
      owner,
      status: 'active' as const,
      plan: plan as 'free' | 'basic' | 'pro' | 'enterprise',
      createdAt: new Date().toISOString(),
      usersCount: 0,
      messagesCount: 0,
    };

    stores.push(newStore);
    await writeStoreRegistry(stores);

    return NextResponse.json({
      store: newStore,
      message: 'Store created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}

