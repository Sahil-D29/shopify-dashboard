export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { runCampaignWorkerStep } from '@/jobs/campaign.worker';
import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const result = await runCampaignWorkerStep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Campaign runner error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
