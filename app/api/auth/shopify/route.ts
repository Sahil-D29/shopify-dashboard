export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';
import { prisma } from '@/lib/prisma';
import { UserStatus, UserRole } from '@prisma/client';
import { encryptToken } from '@/lib/shopify-token';
import { registerWebhooks } from '@/lib/shopify-webhooks';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const installUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    installUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    installUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    installUrl.searchParams.set('redirect_uri', redirectUri);
    installUrl.searchParams.set('state', state);

    const response = NextResponse.json({
      installUrl: installUrl.toString(),
      shop: normalizedShop,
    });

    // Store state in httpOnly cookie for verification in callback
    response.cookies.set('shopify_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Remember where to redirect after OAuth
    if (returnTo) {
      response.cookies.set('shopify_oauth_return_to', returnTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    return response;
  } catch (error) {
    console.error('Error generating Shopify OAuth URL:', error);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, shop, state } = body;

    if (!code || !shop || !state) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify state
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    // ── 1. Exchange code for access token ──────────────────────────────
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
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Shopify token exchange error:', errorData);
      return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 500 });
    }

    const { access_token, scope } = await tokenResponse.json();

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
      // Return plain token so frontend can save to localStorage for fetchWithConfig
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
    console.error('Error completing Shopify OAuth:', error);
    return NextResponse.json({ error: 'Failed to complete OAuth flow' }, { status: 500 });
  }
}
