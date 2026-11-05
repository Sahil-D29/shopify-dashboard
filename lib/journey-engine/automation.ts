import { prisma } from '@/lib/prisma';
import { runCampaignWorkerStep } from '@/jobs/campaign.worker';
import { runFollowUpWorkerStep } from '@/jobs/campaign-followup.worker';
import { runJourneyTriggerTick } from '@/lib/journeys/trigger-scheduler';
import { processScheduledExecutions } from './executor';

let running = false;
export async function runAutomationTick() {
  if (running) return { skipped: true };
  running = true;
  const started = new Date();
  const failures: string[] = [];
  try {
    await prisma.automationHeartbeat.upsert({ where: { id: 'whatsapp' }, create: { id: 'whatsapp', lastStartedAt: started }, update: { lastStartedAt: started } });
    for (const [name, run] of [
      ['campaigns', async () => { for (let i = 0; i < 10; i++) { const r = await runCampaignWorkerStep(); if (!r.processed) break; } }],
      ['journey entries', runJourneyTriggerTick],
      ['journey delays', () => processScheduledExecutions(new Date().toISOString())],
      ['follow-ups', runFollowUpWorkerStep],
    ] as const) {
      try { await run(); } catch (error) { failures.push(name); console.error(`[automation] ${name} failed`, error); }
    }
    await prisma.automationHeartbeat.update({ where: { id: 'whatsapp' }, data: { lastFinishedAt: new Date(), error: failures.length ? failures.join(', ') : null } });
    return { ok: !failures.length, failures };
  } finally { running = false; }
}

export async function automationStatus(storeId: string, journeyId?: string) {
  const heartbeat = await prisma.automationHeartbeat.findUnique({ where: { id: 'whatsapp' } });
  const journeys = await prisma.journeyDoc.findMany({ where: { storeId, ...(journeyId ? { id: journeyId } : {}) }, select: { id: true } });
  const ids = journeys.map(j => j.id);
  const schedules = await prisma.journeyScheduleDoc.findMany({ where: { journeyId: { in: ids }, status: { in: ['pending', 'processing', 'failed'] } }, orderBy: { resumeAt: 'asc' }, take: 20 });
  const enrollments = await prisma.journeyEnrollmentDoc.findMany({ where: { journeyId: { in: ids } }, orderBy: { updatedAt: 'desc' }, take: 20 });
  const campaignJobs = await prisma.campaignQueueItem.findMany({ where: { storeId, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } }, orderBy: { scheduledAt: 'asc' }, take: 20, select: { id: true, campaignId: true, scheduledAt: true, status: true, lastError: true } });
  const enabled = process.env.INTERNAL_CRON_ENABLED === 'true';
  const stale = !heartbeat || Date.now() - heartbeat.lastStartedAt.getTime() > 5 * 60_000;
  return { enabled, stale, lastStartedAt: heartbeat?.lastStartedAt, lastFinishedAt: heartbeat?.lastFinishedAt, error: heartbeat?.error,
    schedules: schedules.map(s => ({ id: s.id, nodeId: s.nodeId, journeyId: s.journeyId, resumeAt: s.resumeAt, status: s.status, error: (s.data as any)?.error, overdue: s.status === 'pending' && s.resumeAt.getTime() < Date.now() - 120000 })),
    campaignJobs,
    enrollments: enrollments.map(e => ({ id: e.id, status: e.status, reason: (e.data as any)?.exitReason ?? ((e.data as any)?.context?.triggerEvent?.cart_token ? 'abandoned_checkout' : 'trigger_matched') })) };
}
