export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { processScheduledJourneySteps } from '@/lib/journey-engine/scheduler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processScheduledJourneySteps();
  return NextResponse.json({ ok: true, ...result });
}

