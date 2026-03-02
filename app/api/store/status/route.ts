export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/store/status
 * Returns the current user's Shopify store connection status.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ connected: false, store: null });
    }

    // Find a store owned by this user that has a real Shopify domain
    const store = await prisma.store.findFirst({
      where: {
        ownerId: session.user.id,
        isActive: true,
        shopifyDomain: { not: { startsWith: 'default-' } },
      },
      select: {
        id: true,
        shopifyDomain: true,
        storeName: true,
        scope: true,
        installedAt: true,
        isActive: true,
      },
      orderBy: { installedAt: 'desc' },
    });

    if (!store) {
      return NextResponse.json({ connected: false, store: null });
    }

    return NextResponse.json({
      connected: true,
      store: {
        id: store.id,
        domain: store.shopifyDomain,
        name: store.storeName,
        scope: store.scope,
        connectedAt: store.installedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Store Status] Error:', error);
    return NextResponse.json({ connected: false, store: null });
  }
}
