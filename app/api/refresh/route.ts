export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    const store = await getStore(shop);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Trigger refresh by clearing cache and fetching fresh data
    // This is a simplified version - in production, you might want to queue background jobs
    const endpoints = ['products', 'orders', 'customers', 'locations'];
    
    // Fire and forget - fetch in background
    endpoints.forEach(async (endpoint) => {
      try {
        await fetch(`${getBaseUrl()}/api/${endpoint}`, {
          headers: {
            'X-Shopify-Shop': shop,
            'X-Shopify-Access-Token': store.accessToken,
          },
        });
      } catch (error) {
        console.error(`Failed to refresh ${endpoint}:`, error);
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Refresh initiated',
      shop,
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh' },
      { status: 500 }
    );
  }
}


