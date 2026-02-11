export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // TODO: Fetch actual discount codes from Shopify API
    // For now, return mock data
    const codes = [
      { code: 'WELCOME10', label: 'WELCOME10 - 10% off' },
      { code: 'SUMMER20', label: 'SUMMER20 - 20% off' },
      { code: 'FREESHIP', label: 'FREESHIP - Free shipping' },
      { code: 'FLASH30', label: 'FLASH30 - 30% off' },
      { code: 'NEWUSER', label: 'NEWUSER - New user discount' },
    ].filter(c => c.code.toLowerCase().includes(search.toLowerCase()));

    return NextResponse.json({ items: codes });
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discount codes', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

