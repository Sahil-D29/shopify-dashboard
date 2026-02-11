import { ShopifyClient } from './client';

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
 * Get Shopify configuration from request headers
 * Clients send config in X-Shopify-Config header as JSON (shopUrl or shop + accessToken)
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
 * Create a ShopifyClient instance with config from request or fallback to env vars
 */
export function getShopifyClient(request: Request): ShopifyClient {
  const config = getConfigFromRequest(request);
  
  if (config) {
    return new ShopifyClient(config);
  }

  // Fallback to environment variables
  return new ShopifyClient();
}

