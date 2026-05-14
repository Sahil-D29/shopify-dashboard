export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';
import { prisma } from '@/lib/prisma';
import { UserStatus, UserRole } from '@prisma/client';
import { encryptToken } from '@/lib/shopify-token';
import { registerWebhooks } from '@/lib/shopify-webhooks';

const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
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
 * GET /api/auth/shopify/callback
 *
 * Shopify redirects here after the merchant authorizes our app.
 * Receives: ?code=xxx&hmac=xxx&shop=xxx.myshopify.com&state=xxx&timestamp=xxx
 *
 * This handles BOTH flows:
 *   1. App Store installs (no session — merchant hasn't signed in yet)
 *   2. Manual OAuth from settings page (has session)
 *
 * Steps:
 *   1. Verify HMAC signature (proves request came from Shopify)
 *   2. Exchange authorization code for permanent access token
 *   3. Save/update store in database
 *   4. Register webhooks
 *   5. Redirect to app UI immediately
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const hmac = searchParams.get('hmac');

    console.log('[OAuth Callback] Received callback:', {
      shop,
      hasCode: !!code,
      hasState: !!state,
      hasHmac: !!hmac,
    });

    // Handle OAuth errors from Shopify
    const oauthError = searchParams.get('error');
    if (oauthError) {
      console.error('[OAuth Callback] Shopify returned error:', oauthError);
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=shopify_denied&message=${encodeURIComponent(oauthError)}`);
    }

    // ── 1. Validate required params ──────────────────────────────────────
    if (!code || !shop || !state) {
      console.error('[OAuth Callback] Missing required params:', {
        code: !!code,
        shop: !!shop,
        state: !!state,
      });
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=missing_params`);
    }

    // ── 2. Verify HMAC signature ─────────────────────────────────────────
    // This proves the request actually came from Shopify
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
        const isValid = crypto.timingSafeEqual(
          Buffer.from(hmac, 'utf8'),
          Buffer.from(digest, 'utf8'),
        );
        if (!isValid) {
          console.error('[OAuth Callback] HMAC verification failed');
          return NextResponse.redirect(`${baseUrl}/auth/signin?error=invalid_hmac`);
        }
        console.log('[OAuth Callback] HMAC verified successfully');
      } catch (e) {
        console.error('[OAuth Callback] HMAC comparison error:', e);
        return NextResponse.redirect(`${baseUrl}/auth/signin?error=hmac_error`);
      }
    } else {
      console.warn('[OAuth Callback] No HMAC or no API secret — skipping verification');
    }

    // ── 3. State verification (soft — cookies may not survive redirect) ──
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (storedState && storedState !== state) {
      console.warn('[OAuth Callback] State mismatch — stored and received differ');
      // Don't hard-fail: for App Store installs, the state cookie from
      // /api/auth/install may not survive the cross-domain redirect chain.
    }

    // ── 4. Validate API credentials ──────────────────────────────────────
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      console.error('[OAuth Callback] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET');
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=app_not_configured`);
    }

    // ── 5. Exchange authorization code for access token ──────────────────
    console.log('[OAuth Callback] Exchanging code for token:', shop);
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text().catch(() => '');
      console.error('[OAuth Callback] Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=token_exchange_failed`);
    }

    const { access_token, scope } = await tokenResponse.json();
    console.log('[OAuth Callback] Token received, scopes:', scope);

    // ── 6. Fetch shop info ───────────────────────────────────────────────
    let shopName = shop.replace('.myshopify.com', '');
    let shopEmail = '';
    try {
      const shopResponse = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
        { headers: { 'X-Shopify-Access-Token': access_token } },
      );
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        shopName = shopData.shop?.name || shopName;
        shopEmail = shopData.shop?.email || '';
      }
    } catch (e) {
      console.warn('[OAuth Callback] Failed to fetch shop info:', e);
    }

    // ── 7. Save store to database ────────────────────────────────────────
    const shopifyStoreId = `store_${shop
      .replace('.myshopify.com', '')
      .replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Try to find the owner from state (manual OAuth from settings) or by email
    let ownerUserId: string | null = null;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      ownerUserId = stateData.userId || null;
    } catch {
      // State may be a nonce-only payload from App Store install
    }

    let owner;
    if (ownerUserId) {
      owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
    }
    if (!owner && shopEmail) {
      owner = await prisma.user.findUnique({ where: { email: shopEmail } });
    }
    if (!owner) {
      // App Store install with no existing user — create one
      const email = shopEmail || `${shop.replace('.myshopify.com', '')}@shopify-install.dorza.io`;
      owner = await prisma.user.upsert({
        where: { email },
        update: {
          name: shopName,
          role: UserRole.STORE_OWNER,
          status: UserStatus.ACTIVE,
        },
        create: {
          email,
          name: shopName,
          role: UserRole.STORE_OWNER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptToken(access_token);
    } catch {
      console.warn('[OAuth Callback] Token encryption failed, storing plain text');
      encryptedToken = access_token;
    }

    // Check for default store to upgrade or upsert by domain
    const defaultStore = await prisma.store.findFirst({
      where: { ownerId: owner.id, shopifyDomain: { startsWith: 'default-' } },
    });
    const existingWithDomain = await prisma.store.findUnique({
      where: { shopifyDomain: shop },
      select: { id: true },
    });

    let store;
    if (defaultStore && (!existingWithDomain || existingWithDomain.id === defaultStore.id)) {
      store = await prisma.store.update({
        where: { id: defaultStore.id },
        data: {
          shopifyDomain: shop,
          shopifyStoreId,
          storeName: shopName,
          accessToken: encryptedToken,
          scope: scope || SHOPIFY_SCOPES,
          isActive: true,
          installedAt: new Date(),
        },
      });
    } else {
      store = await prisma.store.upsert({
        where: { shopifyDomain: shop },
        update: {
          storeName: shopName,
          accessToken: encryptedToken,
          scope: scope || SHOPIFY_SCOPES,
          isActive: true,
          ownerId: owner.id,
          installedAt: new Date(),
        },
        create: {
          shopifyDomain: shop,
          shopifyStoreId,
          storeName: shopName,
          accessToken: encryptedToken,
          scope: scope || SHOPIFY_SCOPES,
          isActive: true,
          ownerId: owner.id,
        },
      });
    }

    console.log('[OAuth Callback] Store saved:', {
      storeId: store.id,
      shopName,
      shop,
    });

    // ── 8. Register webhooks (fire-and-forget) ───────────────────────────
    registerWebhooks(shop, access_token).catch((err) =>
      console.error('[OAuth Callback] Webhook registration failed:', err),
    );

    // ── 9. Redirect to app UI immediately ────────────────────────────────
    // Shopify requires the app to redirect to its UI right after install.
    const returnTo = request.cookies.get('shopify_oauth_return_to')?.value;
    let redirectTarget: string;

    if (returnTo === 'onboarding') {
      redirectTarget = `${baseUrl}/settings?tab=shopify&connected=true`;
    } else if (returnTo === 'settings') {
      redirectTarget = `${baseUrl}/settings?success=shopify_connected&storeId=${store.id}`;
    } else {
      // Default: go to dashboard (Shopify App Store check expects this)
      redirectTarget = `${baseUrl}/dashboard?shop=${encodeURIComponent(shop)}&installed=true`;
    }

    console.log('[OAuth Callback] Redirecting to app UI:', redirectTarget);

    const response = NextResponse.redirect(redirectTarget);

    // Set tenant cookie so the app knows which store to use
    response.cookies.set('current_store_id', store.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });

    // Clean up OAuth cookies
    response.cookies.delete('shopify_oauth_state');
    response.cookies.delete('shopify_oauth_return_to');

    return response;
  } catch (error) {
    console.error('[OAuth Callback] Unhandled error:', error);
    return NextResponse.redirect(`${baseUrl}/auth/signin?error=callback_failed`);
  }
}
