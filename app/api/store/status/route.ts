export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantStoreId, validateTenantAccess } from '@/lib/tenant/tenant-middleware';

function hasRealShopifyConnection(store: {
  isActive: boolean;
  shopifyDomain: string | null;
  accessToken: string;
} | null): boolean {
  return Boolean(
    store?.isActive &&
      store.shopifyDomain?.endsWith('.myshopify.com') &&
      store.accessToken &&
      !['none', 'placeholder_token', ''].includes(store.accessToken),
  );
}

/**
 * GET /api/store/status
 * Returns Shopify connection status for the active/selected store.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ connected: false, store: null });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email },
        ],
      },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ connected: false, store: null });
    }

    const requestedStoreId = await getTenantStoreId(request);
    if (requestedStoreId) {
      const hasAccess = await validateTenantAccess(user.id, requestedStoreId);
      if (!hasAccess) {
        return NextResponse.json({ connected: false, store: null }, { status: 403 });
      }
    }

    const select = {
      id: true,
      shopifyDomain: true,
      storeName: true,
      scope: true,
      installedAt: true,
      isActive: true,
      accessToken: true,
    } as const;

    const connectedStoreWhere = {
      isActive: true,
      shopifyDomain: { endsWith: '.myshopify.com' },
      NOT: [
        { accessToken: '' },
        { accessToken: 'none' },
        { accessToken: 'placeholder_token' },
      ],
    };

    const store = requestedStoreId
      ? await prisma.store.findFirst({
          where: { id: requestedStoreId, isActive: true },
          select,
        })
      : await prisma.store.findFirst({
          where:
            user.role === 'SUPER_ADMIN'
              ? connectedStoreWhere
              : {
                  ...connectedStoreWhere,
                  OR: [
                    { ownerId: user.id },
                    { members: { some: { userId: user.id, status: 'ACTIVE' } } },
                  ],
                },
          select,
          orderBy: { installedAt: 'desc' },
        });

    if (!hasRealShopifyConnection(store)) {
      return NextResponse.json({ connected: false, store: null });
    }

    return NextResponse.json({
      connected: true,
      store: {
        id: store!.id,
        domain: store!.shopifyDomain,
        name: store!.storeName,
        scope: store!.scope,
        connectedAt: store!.installedAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Store Status] Error:', error);
    return NextResponse.json({ connected: false, store: null });
  }
}
