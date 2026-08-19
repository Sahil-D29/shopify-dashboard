export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { runShopifyTokenCheck } from '@/jobs/shopify-token.worker';
import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

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
