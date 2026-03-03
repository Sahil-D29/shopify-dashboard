import { StoreConfigManager } from './store-config';

/**
 * @deprecated Use plain `fetch()` instead. The backend now resolves store credentials
 * from the `current_store_id` cookie via `resolveStore()`, so there's no need to
 * send tokens in headers from the frontend.
 */
export async function fetchWithConfig(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('fetchWithConfig can only be used on the client side');
  }

  const config = StoreConfigManager.getConfig();

  if (!config || !config.shopUrl || !config.accessToken) {
    throw new Error('Store configuration not found. Please configure your store in Settings.');
  }

  const headers = new Headers(options.headers);
  headers.set('X-Shopify-Config', JSON.stringify({
    shopUrl: config.shopUrl,
    accessToken: config.accessToken,
  }));

  return fetch(url, {
    ...options,
    headers,
  });
}
