import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import fs from 'fs/promises';
import path from 'path';
import { readStores } from '@/lib/store';
import { readStoreRegistry } from '@/lib/store-registry';

const WHATSAPP_CONFIG_FILE = path.join(process.cwd(), 'data', 'whatsapp-config.json');

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

    // Check configuration status
    let shopifyConfigured = false;
    let whatsappConfigured = false;

    // Check Shopify config
    try {
      const stores = await readStores();
      const hasStores = Object.keys(stores).length > 0;
      if (hasStores) {
        const storeEntries = Object.values(stores);
        shopifyConfigured = storeEntries.some(store => !!(store.shop && store.accessToken));
      }
      
      if (!shopifyConfigured) {
        const registry = await readStoreRegistry();
        shopifyConfigured = !!(registry && registry.length > 0);
      }
    } catch (error) {
      console.log('[Setup Status] Error checking Shopify config:', error);
    }

    // Check WhatsApp config
    try {
      await fs.access(WHATSAPP_CONFIG_FILE);
      const data = await fs.readFile(WHATSAPP_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      whatsappConfigured = !!(config.wabaId && config.phoneNumberId && config.accessToken);
    } catch (error) {
      // WhatsApp not configured
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


