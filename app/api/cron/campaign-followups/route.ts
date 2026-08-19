/**
 * Cron endpoint for processing campaign follow-ups.
 *
 * Call this every 10 minutes via:
 *   - Vercel Cron (vercel.json)
 *   - External cron service (e.g., cron-job.org)
 *   - Render background worker
 *
 * Security: Requires CRON_SECRET to prevent unauthorized access.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { runFollowUpWorkerStep } from '@/jobs/campaign-followup.worker';
import { verifyCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await runFollowUpWorkerStep();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Campaign follow-up processing error:', error);
    return NextResponse.json(
      {
        error: 'Follow-up processing failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
