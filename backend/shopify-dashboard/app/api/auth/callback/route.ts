import { NextRequest, NextResponse } from 'next/server';
import { verifyOAuthCallback, exchangeCodeForToken, normalizeShopDomain } from '@/lib/shopify';
import { saveStore } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const hmac = searchParams.get('hmac');

    if (!code || !shop || !hmac) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Shopify API credentials not configured' },
        { status: 500 }
      );
    }

    // Verify HMAC signature
    const isValid = verifyOAuthCallback(searchParams, apiSecret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid HMAC signature' },
        { status: 401 }
      );
    }

    const normalizedShop = normalizeShopDomain(shop);

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(normalizedShop, code, apiKey, apiSecret);

    // Save store configuration
    await saveStore({
      shop: normalizedShop,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      installedAt: Date.now(),
    });

    // Redirect to dashboard or settings page
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
    return NextResponse.redirect(`${appUrl}/settings?installed=true&shop=${normalizedShop}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete OAuth installation' },
      { status: 500 }
    );
  }
}


