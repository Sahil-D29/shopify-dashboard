import { ShopifyClient } from './client';
import { ShopifyConfig } from '@/lib/store-config';

// Re-export ShopifyClient for convenience
export { ShopifyClient };

/**
 * Get Shopify configuration from request headers
 * Clients should send config in X-Shopify-Config header as JSON string
 */
export function getConfigFromRequest(request: Request): ShopifyConfig | null {
  try {
    const configHeader = request.headers.get('X-Shopify-Config');
    if (!configHeader) {
      return null;
    }

    const config = JSON.parse(configHeader) as ShopifyConfig;
    
    // Validate config structure
    if (
      config &&
      typeof config.shopUrl === 'string' &&
      typeof config.accessToken === 'string' &&
      config.shopUrl.length > 0 &&
      config.accessToken.length > 0
    ) {
      return {
        shop: config.shopUrl,
        accessToken: config.accessToken,
      };
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

