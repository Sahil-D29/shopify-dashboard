import { NextResponse } from 'next/server';
import { getStoresForUser, createStoreForUser } from '@/lib/store-registry';
import { auth } from '@/lib/auth';

/**
 * GET /api/stores
 * Get all stores that the current user has access to (owner or member)
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stores = await getStoresForUser(session.user.id);
    return NextResponse.json({
      stores,
      total: stores.length,
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
 * Create a new store; caller becomes OWNER (StoreMember with role OWNER).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, shopDomain } = body;

    if (!name || !shopDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: name, shopDomain' },
        { status: 400 }
      );
    }

    const raw = String(shopDomain).trim().toLowerCase();
    const domain = raw.endsWith('.myshopify.com')
      ? raw
      : `${raw.replace(/\.myshopify\.com$/i, '')}.myshopify.com`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid shop domain (e.g. your-store.myshopify.com)' },
        { status: 400 }
      );
    }

    const store = await createStoreForUser(session.user.id, {
      name: String(name).trim(),
      shopDomain: domain,
    });

    return NextResponse.json(
      { store, message: 'Store created successfully. You are the owner.' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating store:', error);
    const message =
      error?.message === 'Store with this domain already exists'
        ? error.message
        : 'Failed to create store';
    return NextResponse.json(
      { error: message },
      { status: error?.message === 'Store with this domain already exists' ? 409 : 500 }
    );
  }
}

