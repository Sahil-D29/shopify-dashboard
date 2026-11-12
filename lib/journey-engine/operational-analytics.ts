import { prisma } from '@/lib/prisma';

type JsonRecord = Record<string, any>;

const record = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

export interface JourneyOperationalMetrics {
  totalEnrolled: number;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  suppressed: number;
  dropped: number;
  conversionRate: number;
  enrollment: {
    received: number;
    enrolled: number;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    suppressed: number;
    duplicate: number;
    purchased: number;
    filtered: number;
    missingContact: number;
  };
  messages: {
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
    unknown: number;
    deliveryRate: number;
    readRate: number;
    clickRate: number;
    lastReceiptAt: string | null;
  };
  updatedAt: string;
}

export async function computeOperationalMetrics(
  storeId: string,
  journeyId: string,
): Promise<JourneyOperationalMetrics | null> {
  const journey = await prisma.journeyDoc.findFirst({
    where: { id: journeyId, storeId },
    select: { id: true },
  });
  if (!journey) return null;

  const [enrollments, evaluations, links] = await Promise.all([
    prisma.journeyEnrollmentDoc.findMany({
      where: { journeyId },
      select: { id: true, status: true, data: true, updatedAt: true },
    }),
    prisma.journeyEventEvaluation.findMany({
      where: { storeId, journeyId },
      select: { outcome: true, createdAt: true },
    }),
    prisma.journeyTrackedLink.findMany({
      where: { storeId, journeyId },
      select: { firstClickedAt: true, lastClickedAt: true },
    }),
  ]);
  const enrollmentIds = enrollments.map(item => item.id);
  const activities = enrollmentIds.length
    ? await prisma.journeyActivityDoc.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        select: { enrollmentId: true, data: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const statusCount = (status: string) => enrollments.filter(item => item.status === status).length;
  const active = statusCount('active');
  const waiting = statusCount('waiting');
  const completed = statusCount('completed');
  const failedEnrollments = statusCount('failed');
  const suppressed = statusCount('suppressed');
  const exited = statusCount('exited');

  const accepted = new Map<string, { enrollmentId: string; at: Date }>();
  const receipts = new Map<string, { status: string; at: Date }>();
  for (const activity of activities) {
    const outer = record(activity.data);
    const payload = record(outer.data);
    const eventType = String(outer.eventType ?? '');
    if (eventType === 'whatsapp_sent') {
      const result = record(payload.result);
      if (typeof result.messageId === 'string' && result.messageId) {
        accepted.set(result.messageId, { enrollmentId: activity.enrollmentId, at: activity.createdAt });
      }
    }
    if (eventType === 'whatsapp_status' || eventType === 'delivery_failed') {
      const messageId = typeof payload.messageId === 'string' ? payload.messageId : '';
      if (messageId) receipts.set(messageId, { status: String(payload.status ?? '').toUpperCase(), at: activity.createdAt });
    }
  }

  let sent = 0;
  let delivered = 0;
  let read = 0;
  let messageFailed = 0;
  let lastReceiptAt: Date | null = null;
  for (const messageId of accepted.keys()) {
    const receipt = receipts.get(messageId);
    if (!receipt) continue;
    if (!lastReceiptAt || receipt.at > lastReceiptAt) lastReceiptAt = receipt.at;
    if (['SENT', 'DELIVERED', 'READ'].includes(receipt.status)) sent += 1;
    if (['DELIVERED', 'READ'].includes(receipt.status)) delivered += 1;
    if (receipt.status === 'READ') read += 1;
    if (receipt.status === 'FAILED') messageFailed += 1;
  }
  const acceptedCount = accepted.size;
  const clicked = links.filter(link => Boolean(link.firstClickedAt)).length;
  const unknown = Math.max(0, acceptedCount - sent - messageFailed);
  const outcome = (name: string) => evaluations.filter(item => item.outcome === name).length;
  const evaluatedReceived = evaluations.length;
  const entered = enrollments.length;
  const converted = enrollments.filter(item => record(item.data).goalAchieved === true).length;
  const percent = (value: number, denominator: number) => denominator
    ? Number(((value / denominator) * 100).toFixed(1))
    : 0;
  const lastUpdate = [
    ...enrollments.map(item => item.updatedAt),
    ...evaluations.map(item => item.createdAt),
    ...activities.map(item => item.createdAt),
    ...links.map(item => item.lastClickedAt).filter((value): value is Date => Boolean(value)),
  ].sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();

  return {
    totalEnrolled: entered,
    active,
    waiting,
    completed,
    failed: failedEnrollments,
    suppressed,
    dropped: failedEnrollments + exited + suppressed,
    conversionRate: percent(converted, entered),
    enrollment: {
      received: Math.max(evaluatedReceived, entered),
      enrolled: entered,
      active,
      waiting,
      completed,
      failed: failedEnrollments,
      suppressed,
      duplicate: outcome('DUPLICATE'),
      purchased: outcome('PURCHASED'),
      filtered: outcome('FILTERED'),
      missingContact: outcome('MISSING_CONTACT') + outcome('MISSING_PHONE'),
    },
    messages: {
      accepted: acceptedCount,
      sent,
      delivered,
      read,
      clicked,
      failed: messageFailed,
      unknown,
      deliveryRate: percent(delivered, acceptedCount),
      readRate: percent(read, delivered),
      clickRate: percent(clicked, delivered),
      lastReceiptAt: lastReceiptAt?.toISOString() ?? null,
    },
    updatedAt: lastUpdate.toISOString(),
  };
}

export async function getEnrollmentMessageStates(storeId: string, journeyId: string) {
  const journey = await prisma.journeyDoc.findFirst({ where: { id: journeyId, storeId }, select: { id: true } });
  if (!journey) return new Map<string, JsonRecord>();
  const enrollments = await prisma.journeyEnrollmentDoc.findMany({ where: { journeyId }, select: { id: true } });
  const ids = enrollments.map(item => item.id);
  if (!ids.length) return new Map<string, JsonRecord>();
  const [activities, links] = await Promise.all([
    prisma.journeyActivityDoc.findMany({ where: { enrollmentId: { in: ids } }, select: { enrollmentId: true, data: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.journeyTrackedLink.findMany({ where: { storeId, journeyId }, select: { enrollmentId: true, firstClickedAt: true } }),
  ]);
  const states = new Map<string, JsonRecord>();
  for (const activity of activities) {
    const outer = record(activity.data);
    const data = record(outer.data);
    const state = states.get(activity.enrollmentId) ?? {};
    if (outer.eventType === 'whatsapp_sent') {
      state.acceptedAt = activity.createdAt.toISOString();
      state.messageId = record(data.result).messageId;
      state.status = 'ACCEPTED';
    }
    if (outer.eventType === 'whatsapp_status' || outer.eventType === 'delivery_failed') {
      state.status = String(data.status ?? (outer.eventType === 'delivery_failed' ? 'FAILED' : '')).toUpperCase();
      state.statusAt = activity.createdAt.toISOString();
    }
    states.set(activity.enrollmentId, state);
  }
  for (const link of links) {
    if (!link.firstClickedAt) continue;
    const state = states.get(link.enrollmentId) ?? {};
    state.clickedAt = link.firstClickedAt.toISOString();
    states.set(link.enrollmentId, state);
  }
  return states;
}
