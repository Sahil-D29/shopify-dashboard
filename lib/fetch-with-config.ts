import { StoreConfigManager } from './store-config';

/**
 * Enhanced fetch function that automatically includes Shopify configuration in headers
 * This allows API routes to use dynamic configuration from window.storage
 * 
 * Note: This only works in client components. For server components,
 * configuration should be passed via headers or API routes will fall back to env vars.
 */
export async function fetchWithConfig(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Only run on client-side
  if (typeof window === 'undefined') {
    throw new Error('fetchWithConfig can only be used on the client side');
  }

  const config = StoreConfigManager.getConfig();
  
  console.log('🔍 Fetching with config:', {
    url,
    shopUrl: config?.shopUrl,
    hasAccessToken: !!config?.accessToken,
  });

  if (!config || !config.shopUrl || !config.accessToken) {
    throw new Error('Store configuration not found. Please configure your store in Settings.');
  }

  const headers = new Headers(options.headers);
  
  // Add Shopify configuration to headers
  headers.set('X-Shopify-Config', JSON.stringify({
    shopUrl: config.shopUrl,
    accessToken: config.accessToken,
  }));

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log('✅ Fetch response:', {
    url,
    status: response.status,
    ok: response.ok,
  });

  return response;
}

