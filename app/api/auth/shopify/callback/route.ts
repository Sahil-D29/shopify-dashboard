export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/auth/shopify/callback
 * Shopify redirects here after the merchant authorizes our app.
 * We complete the token exchange then redirect back to the app.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
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

    // Handle OAuth errors from Shopify
    if (error) {
      console.error('Shopify OAuth error:', error);
      const errorUrl = new URL(returnTo === 'onboarding' ? '/onboarding' : '/settings', request.url);
      errorUrl.searchParams.set('error', 'shopify_oauth_failed');
      errorUrl.searchParams.set('message', error);
      return NextResponse.redirect(errorUrl);
    }

    if (!code || !shop || !state) {
      const errorUrl = new URL(returnTo === 'onboarding' ? '/onboarding' : '/settings', request.url);
      errorUrl.searchParams.set('error', 'missing_parameters');
      return NextResponse.redirect(errorUrl);
    }

    // Verify state
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      const errorUrl = new URL(returnTo === 'onboarding' ? '/onboarding' : '/settings', request.url);
      errorUrl.searchParams.set('error', 'invalid_state');
      return NextResponse.redirect(errorUrl);
    }

    // Call our POST endpoint to complete the token exchange + DB save
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
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
      const errorUrl = new URL(returnTo === 'onboarding' ? '/onboarding' : '/settings', request.url);
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

    // Redirect to the right place
    const successPath = returnTo === 'onboarding' ? '/onboarding' : '/settings';
    const successUrl = new URL(successPath, request.url);
    successUrl.searchParams.set('success', 'shopify_connected');
    successUrl.searchParams.set('storeId', data.storeId);
    successUrl.searchParams.set('shopDomain', data.shopDomain);
    successUrl.searchParams.set('shopName', data.shop);
    // Pass token so frontend can save to localStorage (for fetchWithConfig)
    successUrl.searchParams.set('token', data.accessToken);

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
    console.error('Error in Shopify OAuth callback:', error);
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('error', 'callback_error');
    return NextResponse.redirect(errorUrl);
  }
}
