import { NextRequest, NextResponse } from 'next/server';
import { runCampaignWorkerStep } from '@/jobs/campaign.worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
