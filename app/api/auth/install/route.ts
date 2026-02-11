export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { buildInstallUrl, normalizeShopDomain } from '@/lib/shopify';
import crypto from 'crypto';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    let appUrl: string;
    try {
      appUrl = getBaseUrl();
    } catch {
      appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SHOPIFY_API_KEY not configured' },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: 'APP_URL not configured. Set APP_URL or NEXT_PUBLIC_APP_URL in .env.local' },
        { status: 500 }
      );
    }

    const normalizedShop = normalizeShopDomain(shop);
    const redirectUri = `${appUrl}/api/auth/callback`;
    const state = crypto.randomUUID();

    // Store state in session/cookie for verification (simplified - use proper session in production)
    const installUrl = buildInstallUrl(
      normalizedShop,
      apiKey,
      redirectUri,
      'read_products,read_orders,read_customers,read_locations',
      state
    );

    return NextResponse.redirect(installUrl);
  } catch (error: any) {
    console.error('Install error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start OAuth install' },
      { status: 500 }
    );
  }
}

