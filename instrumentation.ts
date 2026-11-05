export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.INTERNAL_CRON_ENABLED !== 'true') return;
  const state = globalThis as typeof globalThis & { __campaignCronStarted?: boolean };
  if (state.__campaignCronStarted) return;
  state.__campaignCronStarted = true;
  const { runAutomationTick } = await import('@/lib/journey-engine/automation');
  const tick = () => void runAutomationTick().catch(error => console.error('[automation] tick failed', error));
  setInterval(tick, 60_000);
  tick();
  console.log('[automation] scheduler started (every 60s)');
}
