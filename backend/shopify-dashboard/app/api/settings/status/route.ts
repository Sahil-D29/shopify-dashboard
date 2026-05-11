import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import fs from 'fs/promises';
import path from 'path';
import { readStores } from '@/lib/store';
import { readStoreRegistry } from '@/lib/store-registry';

const WHATSAPP_CONFIG_FILE = path.join(process.cwd(), 'data', 'whatsapp-config.json');

interface SettingsStatus {
  shopifyConfigured: boolean;
  whatsappConfigured: boolean;
  settingsCompleted: boolean;
  missingConfigs: string[];
}

async function checkShopifyConfig(): Promise<boolean> {
  try {
    // Check if there are any stores configured (server-side)
    // Check stores.json file
    try {
      const stores = await readStores();
      const hasStores = Object.keys(stores).length > 0;
      if (hasStores) {
        // Verify at least one store has required fields
        const storeEntries = Object.values(stores);
        return storeEntries.some(store => !!(store.shop && store.accessToken));
      }
    } catch (error) {
      console.log('[Settings Status] Error reading stores.json:', error);
    }
    
    // Also check store registry
    try {
      const registry = await readStoreRegistry();
      return !!(registry && registry.length > 0);
    } catch (error) {
      console.log('[Settings Status] Error reading store registry:', error);
    }
    
    return false;
  } catch (error) {
    console.error('[Settings Status] Error checking Shopify config:', error);
    return false;
  }
}

async function checkWhatsAppConfig(): Promise<boolean> {
  try {
    await fs.access(WHATSAPP_CONFIG_FILE);
    const data = await fs.readFile(WHATSAPP_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    return !!(config.wabaId && config.phoneNumberId && config.accessToken);
  } catch (error) {
    return false;
  }
}

/**
 * GET /api/settings/status
 * Check if store settings are configured
 */
export async function GET(request: NextRequest) {
  try {
    let userContext = null;
    try {
      userContext = await getUserContext(request);
    } catch (error) {
      console.error('[Settings Status API] Error getting user context:', error);
      if (error instanceof Error) {
        console.error('[Settings Status API] Error details:', {
          message: error.message,
          stack: error.stack,
        });
      }
      // Return safe response
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to get user context',
          status: {
            shopifyConfigured: false,
            whatsappConfigured: false,
            settingsCompleted: false,
            missingConfigs: ['Shopify', 'WhatsApp'],
          }
        },
        { status: 200 }
      );
    }
    
    if (!userContext) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          status: {
            shopifyConfigured: false,
            whatsappConfigured: false,
            settingsCompleted: false,
            missingConfigs: ['Shopify', 'WhatsApp'],
          }
        },
        { status: 401 }
      );
    }

    // Log for debugging
    console.log('[Settings Status API] User context:', {
      userId: userContext.userId,
      email: userContext.email,
      role: userContext.role,
      canAccessSettings: userContext.canAccessSettings,
    });

    // Only STORE_OWNER and ADMIN can check settings status
    // But allow if canAccessSettings is true (more flexible check)
    if (!userContext.canAccessSettings && userContext.role !== 'STORE_OWNER' && userContext.role !== 'ADMIN') {
      console.warn('[Settings Status API] Access denied:', {
        role: userContext.role,
        canAccessSettings: userContext.canAccessSettings,
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Access denied',
          status: {
            shopifyConfigured: false,
            whatsappConfigured: false,
            settingsCompleted: false,
            missingConfigs: [],
          }
        },
        { status: 403 }
      );
    }

    const shopifyConfigured = await checkShopifyConfig();
    const whatsappConfigured = await checkWhatsAppConfig();
    const settingsCompleted = shopifyConfigured && whatsappConfigured;
    
    const missingConfigs: string[] = [];
    if (!shopifyConfigured) missingConfigs.push('Shopify');
    if (!whatsappConfigured) missingConfigs.push('WhatsApp');

    const status: SettingsStatus = {
      shopifyConfigured,
      whatsappConfigured,
      settingsCompleted,
      missingConfigs,
    };

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[Settings Status] Error:', error);
    // Log full error details
    if (error instanceof Error) {
      console.error('[Settings Status] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check settings status',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        status: {
          shopifyConfigured: false,
          whatsappConfigured: false,
          settingsCompleted: false,
          missingConfigs: ['Shopify', 'WhatsApp'],
        }
      },
      { status: 200 } // Return 200 to prevent frontend crashes
    );
  }
}

