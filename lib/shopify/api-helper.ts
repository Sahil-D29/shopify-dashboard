import { NextRequest } from 'next/server';
import { ShopifyClient } from './client';
import { resolveStore } from '@/lib/tenant/resolve-store';

// Re-export ShopifyClient for convenience
export { ShopifyClient };

// Local ShopifyConfig interface for API helper
interface ShopifyConfig {
  shop: string;
  accessToken: string;
}

// Client may send shopUrl (from StoreConfigManager) or shop
interface IncomingConfig {
  shop?: string;
  shopUrl?: string;
  accessToken?: string;
}

/**
 * Get Shopify configuration from request headers (legacy — used as fallback only)
 */
export function getConfigFromRequest(request: Request): ShopifyConfig | null {
  try {
    const configHeader = request.headers.get('X-Shopify-Config');
    if (!configHeader) {
      return null;
    }

    const raw = JSON.parse(configHeader) as IncomingConfig;
    const shop = raw.shop ?? raw.shopUrl ?? '';
    const accessToken = raw.accessToken ?? '';

    if (
      typeof shop === 'string' &&
      typeof accessToken === 'string' &&
      shop.length > 0 &&
      accessToken.length > 0
    ) {
      return { shop, accessToken };
    }

    return null;
  } catch (error) {
    console.error('Error parsing config from request:', error);
    return null;
  }
}

/**
 * @deprecated Use getShopifyClientAsync instead — this sync version cannot use DB-based store resolution.
 */
export function getShopifyClient(request: Request): ShopifyClient {
  const config = getConfigFromRequest(request);

  if (config) {
    return new ShopifyClient(config);
  }

  // Fallback to environment variables
  return new ShopifyClient();
}

/**
 * Create a ShopifyClient using DB-based store resolution (secure).
 * Priority: current_store_id cookie → Prisma DB → decrypted token.
 * Falls back to X-Shopify-Config header, then env vars.
 */
export async function getShopifyClientAsync(request: Request): Promise<ShopifyClient> {
  // 1. Try DB-based resolution (current_store_id cookie → Prisma → decrypted token)
  try {
    const store = await resolveStore(request as NextRequest);
    if (store) {
      return new ShopifyClient({ shop: store.shop, accessToken: store.token });
    }
  } catch (err) {
    console.error('[getShopifyClientAsync] resolveStore failed:', err);
  }

  // 2. Fallback to header-based config (backward compat)
  const config = getConfigFromRequest(request);
  if (config) {
    return new ShopifyClient(config);
  }

  // 3. Fallback to env vars
  return new ShopifyClient();
}

