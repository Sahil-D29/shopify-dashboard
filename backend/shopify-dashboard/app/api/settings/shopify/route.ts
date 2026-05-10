import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import { saveStore } from '@/lib/store';
import { readStoreRegistry, writeStoreRegistry } from '@/lib/store-registry';
import type { ShopifyConfig } from '@/lib/store-config';

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

    // Only STORE_OWNER and ADMIN can save settings
    if (userContext.role !== 'STORE_OWNER' && userContext.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const config: ShopifyConfig = {
      shopUrl: body.shopUrl || '',
      accessToken: body.accessToken || '',
      apiKey: body.apiKey || '',
      apiSecret: body.apiSecret || '',
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

    // Also update store registry if needed
    try {
      const stores = await readStoreRegistry();
      const shopName = config.shopUrl.replace('.myshopify.com', '');
      const storeId = `store_${shopName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const existingStore = stores.find(s => s.id === storeId || s.shopDomain === config.shopUrl);
      
      if (!existingStore) {
        stores.push({
          id: storeId,
          name: shopName,
          shopDomain: config.shopUrl,
          owner: userContext.email,
          status: 'active',
          plan: 'basic',
          createdAt: new Date().toISOString(),
        });
        await writeStoreRegistry(stores);
      }
    } catch (error) {
      console.error('[Shopify Settings] Error updating store registry:', error);
      // Continue even if registry update fails
    }

    return NextResponse.json({
      success: true,
      message: 'Shopify configuration saved successfully',
    });
  } catch (error) {
    console.error('[Shopify Settings] POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

