export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledCrossSells } from '@/lib/email/cross-sell';
import { verifyCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await processScheduledCrossSells();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron][email-cross-sell-runner] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
