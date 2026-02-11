/**
 * Journey worker - process scheduled journey steps.
 * Called by GET /api/cron/journey-runner (Vercel Cron or external cron).
 */
import { processScheduledJourneySteps } from '@/lib/journey-engine/scheduler';

export async function runJourneyWorkerStep(): Promise<{ ok: boolean; [key: string]: unknown }> {
  const result = await processScheduledJourneySteps();
  return { ok: true, ...result };
}
