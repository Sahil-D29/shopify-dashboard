export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

/**
 * GET /api/auth/shopify/callback
 * Shopify redirects here after the merchant authorizes our app.
 * We complete the token exchange then redirect back to the app.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      console.warn('[Shopify Callback] No session — redirecting to sign-in');
      const loginUrl = new URL('/auth/signin', request.url);
      loginUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Where should we go after success? (set during GET /api/auth/shopify)
    const returnTo = request.cookies.get('shopify_oauth_return_to')?.value;
    const destPath = returnTo === 'onboarding' ? '/onboarding' : '/settings';

    console.log('[Shopify Callback] Params:', { code: !!code, shop, state: !!state, error, returnTo });

    // Handle OAuth errors from Shopify
    if (error) {
      console.error('[Shopify Callback] Shopify returned error:', error);
      const errorUrl = new URL(destPath, request.url);
      errorUrl.searchParams.set('error', 'shopify_oauth_failed');
      errorUrl.searchParams.set('message', error);
      return NextResponse.redirect(errorUrl);
    }

    if (!code || !shop || !state) {
      console.error('[Shopify Callback] Missing params — code:', !!code, 'shop:', !!shop, 'state:', !!state);
      const errorUrl = new URL(destPath, request.url);
      errorUrl.searchParams.set('error', 'missing_parameters');
      return NextResponse.redirect(errorUrl);
    }

    // Verify state — check cookie first
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('[Shopify Callback] State mismatch — stored:', !!storedState, 'matches:', storedState === state);
      const errorUrl = new URL(destPath, request.url);
      errorUrl.searchParams.set('error', 'invalid_state');
      errorUrl.searchParams.set('message', storedState ? 'State mismatch' : 'State cookie missing (check HTTPS/cookie settings)');
      return NextResponse.redirect(errorUrl);
    }

    // Use consistent base URL — same function used in the GET route
    const baseUrl = getBaseUrl() || request.nextUrl.origin;
    console.log('[Shopify Callback] Calling POST /api/auth/shopify with baseUrl:', baseUrl);

    const oauthResponse = await fetch(`${baseUrl}/api/auth/shopify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ code, shop, state }),
    });

    if (!oauthResponse.ok) {
      const errorData = await oauthResponse.json().catch(() => ({}));
      console.error('[Shopify Callback] POST failed:', oauthResponse.status, errorData);
      const errorUrl = new URL(destPath, request.url);
      errorUrl.searchParams.set('error', 'oauth_failed');
      errorUrl.searchParams.set('message', (errorData as { error?: string }).error || 'Failed to complete OAuth');
      return NextResponse.redirect(errorUrl);
    }

    const data = await oauthResponse.json() as {
      storeId: string;
      shop: string;
      shopDomain: string;
      accessToken: string;
    };

    console.log('[Shopify Callback] OAuth success — storeId:', data.storeId, 'domain:', data.shopDomain);

    // Redirect to the right place
    const successUrl = new URL(destPath, request.url);
    successUrl.searchParams.set('success', 'shopify_connected');
    successUrl.searchParams.set('storeId', data.storeId);
    successUrl.searchParams.set('shopDomain', data.shopDomain);
    successUrl.searchParams.set('shopName', data.shop);
    // Token is stored securely in DB — no need to pass in URL
    const response = NextResponse.redirect(successUrl);

    // Clean up OAuth cookies
    response.cookies.delete('shopify_oauth_state');
    response.cookies.delete('shopify_oauth_return_to');

    // Set tenant cookie
    response.cookies.set('current_store_id', data.storeId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('[Shopify Callback] Unhandled error:', error);
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('error', 'callback_error');
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.redirect(errorUrl);
  }
}
