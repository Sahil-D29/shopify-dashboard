/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * Render runs a persistent Node server, so we schedule the campaign send worker
 * here instead of relying on an external cron. Every minute it drains pending
 * CampaignQueueItems, which is what lets SCHEDULED campaigns fire at their time
 * and failed sends retry. Immediate campaigns are still also run inline on
 * create for instant feedback.
 */
export async function register() {
  // Only the Node.js runtime can run the worker (it uses Prisma, fetch, etc.).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Guard against double-registration (HMR in dev, repeated calls).
  const globalRef = globalThis as typeof globalThis & { __campaignCronStarted?: boolean };
  if (globalRef.__campaignCronStarted) return;
  globalRef.__campaignCronStarted = true;

  const { runCampaignWorkerStep } = await import('@/jobs/campaign.worker');
  const { runJourneyTriggerTick } = await import('@/lib/journeys/trigger-scheduler');

  const TICK_MS = 60_000; // every minute
  const MAX_PER_TICK = 10; // drain up to N queued campaigns per tick

  const tick = async () => {
    // Campaigns: drain the send queue.
    try {
      for (let i = 0; i < MAX_PER_TICK; i++) {
        const result = await runCampaignWorkerStep();
        if (!result.processed && !result.error) break; // queue empty
        if (!result.processed && result.error) break; // hit an error, try again next tick
      }
    } catch (error) {
      console.error('[campaign-cron] tick failed:', error);
    }

    // Journeys: evaluate Segment-Joined triggers and enroll new members.
    try {
      await runJourneyTriggerTick();
    } catch (error) {
      console.error('[journey-cron] tick failed:', error);
    }
  };

  setInterval(() => {
    void tick();
  }, TICK_MS);

  console.log('[campaign-cron] scheduler started (every 60s)');
}
