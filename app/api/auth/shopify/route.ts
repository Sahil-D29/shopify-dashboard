export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
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
  'write_checkouts',
  'write_script_tags',
].join(',');

/**
 * GET /api/auth/shopify
 * Generate Shopify OAuth install URL.
 * The merchant enters their shop domain, we redirect them to Shopify to authorize.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized — please sign in first' }, { status: 401 });
    }

    // Validate API key is configured
    if (!SHOPIFY_API_KEY) {
      console.error('[Shopify OAuth] SHOPIFY_API_KEY is not set');
      return NextResponse.json({ error: 'Shopify app not configured — set SHOPIFY_API_KEY' }, { status: 500 });
    }

    const { searchParams } = request.nextUrl;
    const shop = searchParams.get('shop');
    const returnTo = searchParams.get('return_to'); // 'onboarding' or undefined

    if (!shop) {
      return NextResponse.json({ error: 'Shop parameter is required' }, { status: 400 });
    }

    // Normalize: "mystore" → "mystore.myshopify.com"
    let normalizedShop = shop.trim().toLowerCase();
    if (!normalizedShop.includes('.')) {
      normalizedShop = `${normalizedShop}.myshopify.com`;
    }

    if (!normalizedShop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return NextResponse.json({ error: 'Invalid shop domain format. Example: yourstore.myshopify.com' }, { status: 400 });
    }

    // Generate nonce for state
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(
      JSON.stringify({ nonce, userId: session.user.id }),
    ).toString('base64');

    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/shopify/callback`;

    console.log('[Shopify OAuth] Generating install URL:', {
      shop: normalizedShop,
      baseUrl,
      redirectUri,
      returnTo,
    });

    const installUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    installUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    installUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    installUrl.searchParams.set('redirect_uri', redirectUri);
    installUrl.searchParams.set('state', state);

    const response = NextResponse.json({
      installUrl: installUrl.toString(),
      shop: normalizedShop,
    });

    // Determine cookie security — use secure only when base URL is https
    const useSecureCookie = baseUrl.startsWith('https');

    // Store state in httpOnly cookie for verification in callback
    response.cookies.set('shopify_oauth_state', state, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Remember where to redirect after OAuth
    if (returnTo) {
      response.cookies.set('shopify_oauth_return_to', returnTo, {
        httpOnly: true,
        secure: useSecureCookie,
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    return response;
  } catch (error) {
    console.error('[Shopify OAuth] Error generating install URL:', error);
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
  }
}

/**
 * POST /api/auth/shopify
 * Complete OAuth flow: exchange code for token, save to DB, register webhooks.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      console.warn('[Shopify OAuth POST] No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, shop, state } = body;

    console.log('[Shopify OAuth POST] Starting token exchange for:', shop);

    if (!code || !shop || !state) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify state
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('[Shopify OAuth POST] State mismatch — stored:', !!storedState);
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    // Validate secrets are present
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
      console.error('[Shopify OAuth POST] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET');
      return NextResponse.json({ error: 'Shopify app credentials not configured' }, { status: 500 });
    }

    // ── 1. Exchange code for access token ──────────────────────────────
    console.log('[Shopify OAuth POST] Exchanging code for token at:', `https://${shop}/admin/oauth/access_token`);
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
      console.error('[Shopify OAuth POST] Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.json(
        { error: `Token exchange failed (${tokenResponse.status}): ${errorText || 'Unknown error'}` },
        { status: 500 },
      );
    }

    const { access_token, scope } = await tokenResponse.json();
    console.log('[Shopify OAuth POST] Token received, scope:', scope);

    // ── 2. Fetch shop info ─────────────────────────────────────────────
    const shopResponse = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
      { headers: { 'X-Shopify-Access-Token': access_token } },
    );

    let shopName = shop.replace('.myshopify.com', '');
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      shopName = shopData.shop?.name || shopName;
    }

    // ── 3. Save to Prisma (encrypted token) ────────────────────────────
    const shopifyStoreId = `store_${shop
      .replace('.myshopify.com', '')
      .replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Ensure owner exists in Prisma
    console.log('[Shopify OAuth POST] Upserting user:', session.user.email);
    const owner = await prisma.user.upsert({
      where: { email: session.user.email! },
      update: {
        name: session.user.name || shopName,
        role: UserRole.STORE_OWNER,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: session.user.email!,
        name: session.user.name || shopName,
        role: UserRole.STORE_OWNER,
        status: UserStatus.ACTIVE,
      },
    });

    let encryptedToken: string;
    try {
      encryptedToken = encryptToken(access_token);
    } catch {
      // If encryption fails (missing ENCRYPTION_KEY), store plain text
      console.warn('[OAuth] Token encryption failed, storing plain text');
      encryptedToken = access_token;
    }

    // Check if user has a "default-*" store (from WhatsApp setup) → upgrade it
    const defaultStore = await prisma.store.findFirst({
      where: { ownerId: owner.id, shopifyDomain: { startsWith: 'default-' } },
    });
    const existingWithDomain = await prisma.store.findUnique({
      where: { shopifyDomain: shop },
      select: { id: true },
    });

    let store;
    if (defaultStore && (!existingWithDomain || existingWithDomain.id === defaultStore.id)) {
      // Upgrade the default store to this real Shopify store
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

    // ── 4. Register webhooks (fire-and-forget) ─────────────────────────
    registerWebhooks(shop, access_token).catch((err) =>
      console.error('[OAuth] Webhook registration failed:', err),
    );

    // ── 5. Build response with tenant cookie ───────────────────────────
    const response = NextResponse.json({
      success: true,
      storeId: store.id,
      shop: shopName,
      shopDomain: shop,
      accessToken: access_token,
    });

    // Set tenant cookie so API routes resolve the store immediately
    response.cookies.set('current_store_id', store.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('[Shopify OAuth POST] Unhandled error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `OAuth failed: ${msg}` }, { status: 500 });
  }
}
