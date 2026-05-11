import { NextRequest, NextResponse } from 'next/server';
import { getCacheMetadata } from '@/lib/cache';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const endpoint = searchParams.get('endpoint') || 'products';

    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter' },
        { status: 400 }
      );
    }

    const metadata = await getCacheMetadata(shop, endpoint);

    return NextResponse.json({
      shop,
      endpoint,
      lastUpdated: metadata.lastUpdated,
      exists: metadata.exists,
    });
  } catch (error: any) {
    console.error('Cache metadata error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get cache metadata' },
      { status: 500 }
    );
  }
}


