export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledCampaigns } from '@/lib/email/send-campaign';
import { verifyCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await processScheduledCampaigns();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron][email-campaign-runner] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
