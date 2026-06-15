export const dynamic = 'force-dynamic';
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

    const { store, alreadyExisted } = await createStoreForUser(session.user.id, {
      name: String(name).trim(),
      shopDomain: domain,
    });

    return NextResponse.json(
      {
        store,
        message: alreadyExisted
          ? 'Store already connected. You are the owner.'
          : 'Store created successfully. You are the owner.',
      },
      { status: alreadyExisted ? 200 : 201 }
    );
  } catch (error: any) {
    console.error('Error creating store:', error);
    // Domain belongs to a different account → real conflict.
    if (error?.code === 'STORE_DOMAIN_TAKEN') {
      return NextResponse.json(
        { error: 'This Shopify domain is already connected to another account.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}

