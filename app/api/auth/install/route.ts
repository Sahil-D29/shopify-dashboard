export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_customers',
  'write_customers',
  'read_checkouts',
  'read_analytics',
  'read_inventory',
  'read_discounts',
  'read_channels',
  'read_markets',
].join(',');

/**
 * GET /api/auth/install?shop=xxx.myshopify.com
 *
 * Entry point for Shopify app installation.
 * Shopify sends merchants here when they click "Install" from the App Store.
 * Must immediately redirect to Shopify OAuth authorization screen.
 *
 * Set this as your App URL in the Shopify Partner Dashboard:
 *   https://app.dorza.io/api/auth/install
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const shop = searchParams.get('shop');
    const hmac = searchParams.get('hmac');
    const timestamp = searchParams.get('timestamp');

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 },
      );
    }

    if (!SHOPIFY_API_KEY) {
      console.error('[Install] SHOPIFY_API_KEY is not set');
      return NextResponse.json(
        { error: 'Shopify app not configured' },
        { status: 500 },
      );
    }

    // Validate shop domain format
    let normalizedShop = shop.trim().toLowerCase();
    if (!normalizedShop.includes('.')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }
    if (!normalizedShop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return NextResponse.json(
        { error: 'Invalid shop domain' },
        { status: 400 },
      );
    }

    // Verify HMAC if present (non-blocking — install must always redirect)
    if (hmac && SHOPIFY_API_SECRET) {
      const params = new URLSearchParams(searchParams);
      params.delete('hmac');
      params.delete('signature');
      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      const digest = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(sortedParams, 'utf8')
        .digest('hex');
      try {
        const isValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
        if (!isValid) {
          console.warn('[Install] HMAC mismatch — continuing with redirect');
        }
      } catch {
        console.warn('[Install] HMAC check error — continuing with redirect');
      }
    }

    // Generate state nonce for CSRF protection
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ nonce })).toString('base64');

    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/shopify/callback`;

    // Build Shopify OAuth URL
    const installUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    installUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    installUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    installUrl.searchParams.set('redirect_uri', redirectUri);
    installUrl.searchParams.set('state', state);

    console.log('[Install] Redirecting to Shopify OAuth:', {
      shop: normalizedShop,
      redirectUri,
    });

    // Redirect immediately to Shopify OAuth
    const response = NextResponse.redirect(installUrl.toString());

    const useSecureCookie = baseUrl.startsWith('https');
    response.cookies.set('shopify_oauth_state', state, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      maxAge: 600,
    });

    return response;
  } catch (error) {
    console.error('[Install] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start installation' },
      { status: 500 },
    );
  }
}
