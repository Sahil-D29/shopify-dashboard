/**
 * Client Credentials Grant token provider for Shopify Dev Dashboard apps.
 *
 * Replaces the deprecated static `shpat_` tokens from custom apps.
 * Exchanges SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET for a 24-hour access token
 * and caches it in memory with auto-refresh.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 */

const CLIENT_ID = () => process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '';
const CLIENT_SECRET = () => process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
const DEFAULT_SHOP = () => process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL || '';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedToken>();

function normalizeShop(shop: string): string {
  let s = shop.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  if (!s.includes('.')) {
    s = `${s}.myshopify.com`;
  }
  s = s.replace(/\/$/, '');
  return s;
}

/**
 * Get an access token using the Client Credentials Grant.
 * Tokens are cached in memory and auto-refreshed 60s before expiry.
 *
 * @param shopDomain - e.g. "mystore.myshopify.com" (defaults to SHOPIFY_STORE_DOMAIN env)
 */
export async function getClientCredentialsToken(shopDomain?: string): Promise<string> {
  const shop = normalizeShop(shopDomain || DEFAULT_SHOP());

  if (!shop) {
    throw new Error('[CC Token] No shop domain provided and SHOPIFY_STORE_DOMAIN is not set.');
  }

  const clientId = CLIENT_ID();
  const clientSecret = CLIENT_SECRET();

  if (!clientId || !clientSecret) {
    throw new Error(
      '[CC Token] Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET. ' +
      'Set these in your .env from the Dev Dashboard Settings page.',
    );
  }

  // Return cached token if still valid (with 60s buffer)
  const cached = tokenCache.get(shop);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  // Fetch a new token via Client Credentials Grant
  const url = `https://${shop}/admin/oauth/access_token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  console.log('[CC Token] Requesting new token for:', shop);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[CC Token] Token request failed:', response.status, errorText);
    throw new Error(
      `[CC Token] Failed to get access token (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = await response.json() as {
    access_token: string;
    scope: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + data.expires_in * 1000;

  tokenCache.set(shop, {
    token: data.access_token,
    expiresAt,
  });

  console.log('[CC Token] Token acquired for', shop, '- expires in', data.expires_in, 'seconds');

  return data.access_token;
}

/**
 * Clear the cached token for a shop (e.g., on 401 errors to force re-fetch).
 */
export function clearCachedToken(shopDomain?: string): void {
  const shop = normalizeShop(shopDomain || DEFAULT_SHOP());
  if (shop) {
    tokenCache.delete(shop);
  }
}
