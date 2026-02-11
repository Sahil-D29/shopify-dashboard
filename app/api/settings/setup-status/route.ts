export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/prisma';
import { getTenantStoreId } from '@/lib/tenant/tenant-middleware';

/**
 * GET /api/settings/setup-status
 * Check setup completion status (returns setupCompleted flag)
 * This is used by the useSetupStatus hook to determine if setup has been completed
 */
export async function GET(request: NextRequest) {
  try {
    let userContext = null;
    try {
      userContext = await getUserContext(request);
    } catch (error) {
      console.error('[Setup Status API] Error getting user context:', error);
      return NextResponse.json(
        {
          setupCompleted: false,
          shopifyConfigured: false,
          whatsappConfigured: false,
        },
        { status: 200 }
      );
    }

    if (!userContext) {
      return NextResponse.json(
        {
          setupCompleted: false,
          shopifyConfigured: false,
          whatsappConfigured: false,
        },
        { status: 401 }
      );
    }

    // Resolve store: cookie/query first, then first store for this user (per user/store)
    let storeId = await getTenantStoreId(request);
    if (!storeId && userContext.userId) {
      const firstOwned = await prisma.store.findFirst({
        where: { ownerId: userContext.userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (firstOwned) storeId = firstOwned.id;
      if (!storeId) {
        const firstMember = await prisma.storeMember.findFirst({
          where: { userId: userContext.userId },
          select: { storeId: true },
          orderBy: { createdAt: 'asc' },
        });
        if (firstMember) storeId = firstMember.storeId;
      }
    }

    // Check configuration status for this store only (per user/store persistence)
    let shopifyConfigured = false;
    let whatsappConfigured = false;

    if (storeId) {
      // Check Shopify config for this store (DB is source of truth)
      try {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        shopifyConfigured = !!(store && store.isActive && store.accessToken && store.accessToken !== 'pending');
      } catch (error) {
        console.log('[Setup Status] Error checking Shopify config:', error);
      }

      // Check WhatsApp config for this store (DB only; file is legacy)
      try {
        const dbConfig = await prisma.whatsAppConfig.findUnique({ where: { storeId } });
        whatsappConfigured = !!(dbConfig && dbConfig.isConfigured);
      } catch (error) {
        console.error('[Setup Status] Error checking WhatsApp config in DB:', error);
      }
    }

    // Setup is completed when both are configured
    // Note: The actual setupCompleted flag is stored in localStorage client-side
    // This API just returns the current configuration status
    const setupCompleted = shopifyConfigured && whatsappConfigured;

    return NextResponse.json({
      setupCompleted,
      shopifyConfigured,
      whatsappConfigured,
    });
  } catch (error) {
    console.error('[Setup Status] Error:', error);
    return NextResponse.json(
      {
        setupCompleted: false,
        shopifyConfigured: false,
        whatsappConfigured: false,
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/settings/setup-status
 * Mark setup as completed (client-side only, stored in localStorage)
 * This endpoint is called after both configs are saved
 */
export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This is just a confirmation endpoint
    // The actual setup completion flag is stored client-side in localStorage
    // because the system uses file-based storage and localStorage is the simplest
    // persistence mechanism for this flag
    
    return NextResponse.json({
      success: true,
      message: 'Setup completion acknowledged',
    });
  } catch (error) {
    console.error('[Setup Status POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark setup as complete' },
      { status: 500 }
    );
  }
}


