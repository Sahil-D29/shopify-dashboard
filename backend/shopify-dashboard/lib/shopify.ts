import crypto from 'crypto';

/**
 * Shopify OAuth and API helper functions
 * 
 * SECURITY NOTE: In production, replace file-based token storage with a proper database.
 * Always validate HMAC signatures for webhooks and OAuth callbacks.
 */

export interface ShopifyConfig {
  shop: string;
  accessToken: string;
  scope?: string;
  installedAt?: number;
}

/**
 * Generate HMAC signature for Shopify webhook verification
 */
export function verifyShopifyWebhook(body: string, hmac: string, secret: string): boolean {
  if (!hmac || !secret) return false;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
}

/**
 * Verify OAuth callback HMAC
 */
export function verifyOAuthCallback(
  query: URLSearchParams,
  secret: string
): boolean {
  const hmac = query.get('hmac');
  if (!hmac) return false;

  // Remove hmac and signature from query string for verification
  const params = new URLSearchParams(query);
  params.delete('hmac');
  params.delete('signature');

  // Sort and join parameters
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', secret)
    .update(sortedParams, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
}

/**
 * Build Shopify OAuth install URL
 */
export function buildInstallUrl(
  shop: string,
  apiKey: string,
  redirectUri: string,
  scopes: string = 'read_products,read_orders,read_customers,read_locations',
  state?: string
): string {
  const stateParam = state || crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state: stateParam,
    'grant_options[]': 'per-user',
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string,
  apiKey: string,
  apiSecret: string
): Promise<{ access_token: string; scope: string }> {
  const url = `https://${shop}/admin/oauth/access_token`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Normalize shop domain (remove protocol, ensure .myshopify.com)
 */
export function normalizeShopDomain(shop: string): string {
  let normalized = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!normalized.includes('.')) {
    normalized = `${normalized}.myshopify.com`;
  }
  return normalized;
}


