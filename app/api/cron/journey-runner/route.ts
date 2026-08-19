export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { processScheduledJourneySteps } from '@/lib/journey-engine/scheduler';
import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const result = await processScheduledJourneySteps();
  return NextResponse.json({ ok: true, ...result });
}

