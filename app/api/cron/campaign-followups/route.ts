/**
 * Cron endpoint for processing campaign follow-ups.
 *
 * Call this every 5 minutes via:
 *   - Vercel Cron (vercel.json)
 *   - External cron service (e.g., cron-job.org)
 *   - Render background worker
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { runFollowUpWorkerStep } from '@/jobs/campaign-followup.worker';

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const secretParam = request.nextUrl.searchParams.get('secret');
    if (authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
