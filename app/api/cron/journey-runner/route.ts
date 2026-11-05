export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const { runAutomationTick } = await import('@/lib/journey-engine/automation');
  return NextResponse.json(await runAutomationTick());
}
