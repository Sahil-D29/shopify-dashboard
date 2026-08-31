export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  return NextResponse.json({
    ok: true,
    processed: 0,
    disabled: true,
    reason: 'Journey automation is disabled until tenant isolation is complete.',
  });
}

