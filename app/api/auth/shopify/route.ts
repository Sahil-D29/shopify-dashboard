export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { createStore } from '@/lib/store-registry';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'read_customers',
  'write_customers',
  'read_checkouts',
  'write_script_tags',
].join(',');

/**
 * GET /api/auth/shopify
 * Generate Shopify OAuth install URL
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Validate shop domain format
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return NextResponse.json(
        { error: 'Invalid shop domain format' },
        { status: 400 }
      );
    }

    // Generate nonce for state
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ nonce, userId: session.user.id })).toString('base64');

    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/api/auth/shopify/callback`;
    const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    installUrl.searchParams.set('client_id', SHOPIFY_API_KEY);
    installUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    installUrl.searchParams.set('redirect_uri', redirectUri);
    installUrl.searchParams.set('state', state);

    // Store state in session/cookie for verification
    const response = NextResponse.json({
      installUrl: installUrl.toString(),
      shop,
    });

    // Store state in httpOnly cookie
    response.cookies.set('shopify_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Error generating Shopify OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/shopify
 * Verify and complete OAuth flow (called from callback)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, shop, state } = body;

    if (!code || !shop || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify state
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Shopify token exchange error:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 500 }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Get shop information
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token,
      },
    });

    if (!shopResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch shop information' },
        { status: 500 }
      );
    }

    const shopData = await shopResponse.json();
    const shopName = shopData.shop?.name || shop.replace('.myshopify.com', '');

    // Create or update store record
    const storeId = `store_${shop.replace('.myshopify.com', '').replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    try {
      // Check if store exists
      const { findStoreById, updateStore } = await import('@/lib/store-registry');
      const existingStore = await findStoreById(storeId);

      if (existingStore) {
        // Update existing store
        await updateStore(storeId, {
          shopDomain: shop,
          status: 'active',
          // Note: In production, encrypt access_token before storing
        });
      } else {
        // Create new store
        await createStore({
          name: shopName,
          shopDomain: shop,
          owner: session.user.email || session.user.id,
          plan: 'basic',
        });
      }
    } catch (storeError) {
      console.error('Error creating/updating store:', storeError);
      // Continue even if store creation fails (might already exist)
    }

    // TODO: Store access_token securely (encrypted)
    // For now, we'll need to handle token storage separately
    // This should be stored encrypted in the store record or a secure vault

    return NextResponse.json({
      success: true,
      storeId,
      shop: shopName,
      message: 'Store connected successfully',
    });
  } catch (error) {
    console.error('Error completing Shopify OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth flow' },
      { status: 500 }
    );
  }
}

