export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/prisma';

interface SettingsStatus {
  shopifyConfigured: boolean;
  whatsappConfigured: boolean;
  settingsCompleted: boolean;
  missingConfigs: string[];
}

async function checkShopifyConfig(storeId?: string): Promise<boolean> {
  try {
    if (storeId) {
      // Check specific store
      const store = await prisma.store.findUnique({
        where: { id: storeId }
      });
      return !!(store && store.accessToken);
    }
    
    // Check if any stores exist
    const storeCount = await prisma.store.count({
      where: { isActive: true }
    });
    return storeCount > 0;
  } catch (error) {
    console.error('[Settings Status] Error checking Shopify config:', error);
    return false;
  }
}

async function checkWhatsAppConfig(storeId?: string): Promise<boolean> {
  try {
    if (storeId) {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { storeId }
      });
      return !!(config && config.isConfigured);
    }
    
    // Check if any WhatsApp configs exist
    const configCount = await prisma.whatsAppConfig.count({
      where: { isConfigured: true }
    });
    return configCount > 0;
  } catch (error) {
    console.error('[Settings Status] Error checking WhatsApp config:', error);
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

    // Resolve store to check: current store (cookie/assigned) or first store for this user (per user/store persistence)
    let storeIdToCheck: string | null = userContext.storeId ?? null;
    if (!storeIdToCheck && userContext.userId) {
      const firstOwned = await prisma.store.findFirst({
        where: { ownerId: userContext.userId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (firstOwned) storeIdToCheck = firstOwned.id;
      if (!storeIdToCheck) {
        const firstMember = await prisma.storeMember.findFirst({
          where: { userId: userContext.userId },
          select: { storeId: true },
          orderBy: { createdAt: 'asc' },
        });
        if (firstMember) storeIdToCheck = firstMember.storeId;
      }
    }

    // Per user/store: only consider configured if we have a store and both configs for that store
    const shopifyConfigured = storeIdToCheck
      ? await checkShopifyConfig(storeIdToCheck)
      : false;
    const whatsappConfigured = storeIdToCheck
      ? await checkWhatsAppConfig(storeIdToCheck)
      : false;
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

