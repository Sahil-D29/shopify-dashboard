export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import { saveStore } from '@/lib/store';
import type { ShopifyConfig } from '@/lib/store-config';
import { prisma } from '@/lib/prisma';
import { UserStatus, UserRole } from '@prisma/client';

/**
 * POST /api/settings/shopify
 * Save Shopify configuration server-side
 */
export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const config: ShopifyConfig = {
      shopUrl: body?.shopUrl || '',
      accessToken: body?.accessToken || '',
      apiKey: body?.apiKey || '',
      apiSecret: body?.apiSecret || '',
    };

    // Validate required fields
    if (!config.shopUrl || !config.accessToken || !config.apiKey || !config.apiSecret) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate shop URL format
    const shopUrlPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopUrlPattern.test(config.shopUrl)) {
      return NextResponse.json(
        { success: false, message: 'Invalid shop URL format' },
        { status: 400 }
      );
    }

    // Save to server-side store
    await saveStore({
      shop: config.shopUrl,
      accessToken: config.accessToken,
      scope: 'read_products,read_orders,read_customers',
      installedAt: Date.now(),
    });

    // Create/Update Prisma Store record so it always appears in StoreSwitcher (/api/stores)
    const shopName = config.shopUrl.replace('.myshopify.com', '');
    const shopifyStoreId = `store_${shopName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Ensure owner exists in Prisma (Store requires ownerId FK)
    const prismaRole =
      userContext.role === 'ADMIN'
        ? UserRole.SUPER_ADMIN
        : userContext.role === 'STORE_OWNER'
          ? UserRole.STORE_OWNER
          : UserRole.TEAM_MEMBER;

    const owner = await prisma.user.upsert({
      where: { email: userContext.email },
      update: {
        name: userContext.name || shopName,
        role: prismaRole,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: userContext.email,
        name: userContext.name || shopName,
        role: prismaRole,
        status: UserStatus.ACTIVE,
      },
    });

    // If user has a "default" store (created when they saved WhatsApp first), upgrade it to this Shopify store so WhatsApp stays linked (one store for both)
    const defaultStore = await prisma.store.findFirst({
      where: {
        ownerId: owner.id,
        shopifyDomain: { startsWith: 'default-' },
      },
    });
    const existingWithDomain = await prisma.store.findUnique({
      where: { shopifyDomain: config.shopUrl },
      select: { id: true },
    });
    let store;
    if (defaultStore && (!existingWithDomain || existingWithDomain.id === defaultStore.id)) {
      store = await prisma.store.update({
        where: { id: defaultStore.id },
        data: {
          shopifyDomain: config.shopUrl,
          shopifyStoreId,
          storeName: shopName,
          accessToken: config.accessToken,
          scope: 'read_products,read_orders,read_customers',
          isActive: true,
        },
      });
    } else {
      store = await prisma.store.upsert({
        where: { shopifyDomain: config.shopUrl },
        update: {
          storeName: shopName,
          accessToken: config.accessToken,
          scope: 'read_products,read_orders,read_customers',
          isActive: true,
          ownerId: owner.id,
        },
        create: {
          shopifyDomain: config.shopUrl,
          shopifyStoreId,
          storeName: shopName,
          accessToken: config.accessToken,
          scope: 'read_products,read_orders,read_customers',
          isActive: true,
          ownerId: owner.id,
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Shopify configuration saved successfully',
      store: {
        id: store.id,
        name: store.storeName,
        shopDomain: store.shopifyDomain,
      },
    });

    // Keep tenant cookie in sync so API routes can resolve store immediately
    response.cookies.set('current_store_id', store.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('[Shopify Settings] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

