export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/auth/shopify/callback
 * Handle Shopify OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/auth/signin', request.url);
      loginUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Shopify OAuth error:', error);
      const errorUrl = new URL('/settings', request.url);
      errorUrl.searchParams.set('error', 'shopify_oauth_failed');
      errorUrl.searchParams.set('message', error);
      return NextResponse.redirect(errorUrl);
    }

    if (!code || !shop || !state) {
      const errorUrl = new URL('/settings', request.url);
      errorUrl.searchParams.set('error', 'missing_parameters');
      return NextResponse.redirect(errorUrl);
    }

    // Verify state
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      const errorUrl = new URL('/settings', request.url);
      errorUrl.searchParams.set('error', 'invalid_state');
      return NextResponse.redirect(errorUrl);
    }

    // Call the POST endpoint to complete OAuth
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const oauthResponse = await fetch(`${baseUrl}/api/auth/shopify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ code, shop, state }),
    });

    if (!oauthResponse.ok) {
      const errorData = await oauthResponse.json();
      const errorUrl = new URL('/settings', request.url);
      errorUrl.searchParams.set('error', 'oauth_failed');
      errorUrl.searchParams.set('message', errorData.error || 'Failed to complete OAuth');
      return NextResponse.redirect(errorUrl);
    }

    const data = await oauthResponse.json();

    // Redirect to success page or settings
    const successUrl = new URL('/settings', request.url);
    successUrl.searchParams.set('success', 'shopify_connected');
    successUrl.searchParams.set('storeId', data.storeId);
    
    const response = NextResponse.redirect(successUrl);
    
    // Clear OAuth state cookie
    response.cookies.delete('shopify_oauth_state');
    
    return response;
  } catch (error) {
    console.error('Error in Shopify OAuth callback:', error);
    const errorUrl = new URL('/settings', request.url);
    errorUrl.searchParams.set('error', 'callback_error');
    return NextResponse.redirect(errorUrl);
  }
}

