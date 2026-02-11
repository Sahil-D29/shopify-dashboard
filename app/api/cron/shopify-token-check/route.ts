import { NextRequest, NextResponse } from 'next/server';
import { runShopifyTokenCheck } from '@/jobs/shopify-token.worker';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runShopifyTokenCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Shopify token check error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
