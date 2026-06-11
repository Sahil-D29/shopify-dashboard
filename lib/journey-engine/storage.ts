import { prisma } from '@/lib/prisma';

import type { JourneyDefinition } from '@/lib/types/journey';

/** Strip `undefined` (which Prisma's Json input rejects) before persisting. */
const toJson = (value: unknown): object => JSON.parse(JSON.stringify(value ?? null));

export type JourneyEnrollmentStatus = 'active' | 'waiting' | 'completed' | 'exited' | 'failed';

export interface JourneyEnrollmentRecord {
  id: string;
  journeyId: string;
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  status: JourneyEnrollmentStatus;
  currentNodeId?: string | null;
  completedNodes: string[];
  enteredAt: string;
  lastActivityAt: string;
  completedAt?: string | null;
  goalAchieved?: boolean;
  conversionValue?: number;
  context: Record<string, unknown>;
  waitingForEvent?: string | null;
  waitingForEventTimeout?: string | null;
  waitingForGoal?: boolean;
  goalNodeId?: string | null;
  exitReason?: string;
  metadata?: Record<string, unknown>;
}

export interface JourneyActivityLogRecord {
  id: string;
  enrollmentId: string;
  timestamp: string;
  eventType: string;
  data?: Record<string, unknown>;
}

export interface ScheduledExecutionRecord {
  id: string;
  journeyId: string;
  enrollmentId: string;
  nodeId: string;
  resumeAt: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  createdAt: string;
  processedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const VALID_ENROLLMENT_STATUS: JourneyEnrollmentStatus[] = ['active', 'waiting', 'completed', 'exited', 'failed'];
const VALID_EXECUTION_STATUS: ScheduledExecutionRecord['status'][] = ['pending', 'processed', 'failed', 'cancelled'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value == null) return null;
  return toTrimmedString(value);
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(item => toTrimmedString(item))
        .filter((item): item is string => Boolean(item))
    : [];

const sanitiseRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value));
};

const toEnrollmentStatus = (value: unknown): JourneyEnrollmentStatus | undefined => {
  const status = toTrimmedString(value)?.toLowerCase() as JourneyEnrollmentStatus | undefined;
  return status && VALID_ENROLLMENT_STATUS.includes(status) ? status : undefined;
};

const toExecutionStatus = (value: unknown): ScheduledExecutionRecord['status'] | undefined => {
  const status = toTrimmedString(value)?.toLowerCase() as ScheduledExecutionRecord['status'] | undefined;
  return status && VALID_EXECUTION_STATUS.includes(status) ? status : undefined;
};

const safeDateParse = (value: unknown): number | undefined => {
  const date = toTrimmedString(value);
  if (!date) return undefined;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function normaliseEnrollment(raw: unknown): JourneyEnrollmentRecord | null {
  if (!isRecord(raw)) return null;

  const id = toTrimmedString(raw.id);
  const journeyId = toTrimmedString(raw.journeyId);
  const customerId = toTrimmedString(raw.customerId);
  const status = toEnrollmentStatus(raw.status);
  const enteredAt = toTrimmedString(raw.enteredAt);
  const lastActivityAt = toTrimmedString(raw.lastActivityAt);

  if (!id || !journeyId || !customerId || !status || !enteredAt || !lastActivityAt) {
    return null;
  }

  const completedNodes = toStringArray(raw.completedNodes);
  const context = sanitiseRecord(raw.context);
  const metadata = sanitiseRecord(raw.metadata);

  const record: JourneyEnrollmentRecord = {
    id,
    journeyId,
    customerId,
    status,
    completedNodes,
    enteredAt,
    lastActivityAt,
    context,
  };

  const customerEmail = toTrimmedString(raw.customerEmail);
  if (customerEmail) record.customerEmail = customerEmail;

  const customerPhone = toTrimmedString(raw.customerPhone);
  if (customerPhone) record.customerPhone = customerPhone;

  const currentNodeId = toNullableString(raw.currentNodeId);
  if (typeof currentNodeId !== 'undefined') record.currentNodeId = currentNodeId;

  const completedAt = toNullableString(raw.completedAt);
  if (typeof completedAt !== 'undefined') record.completedAt = completedAt;

  const goalAchieved = toBoolean(raw.goalAchieved);
  if (typeof goalAchieved !== 'undefined') record.goalAchieved = goalAchieved;

  const conversionValue = toNumber(raw.conversionValue);
  if (typeof conversionValue !== 'undefined') record.conversionValue = conversionValue;

  const waitingForEvent = toNullableString(raw.waitingForEvent);
  if (typeof waitingForEvent !== 'undefined') record.waitingForEvent = waitingForEvent;

  const waitingForEventTimeout = toNullableString(raw.waitingForEventTimeout);
  if (typeof waitingForEventTimeout !== 'undefined') record.waitingForEventTimeout = waitingForEventTimeout;

  const waitingForGoal = toBoolean(raw.waitingForGoal);
  if (typeof waitingForGoal !== 'undefined') record.waitingForGoal = waitingForGoal;

  const goalNodeId = toNullableString(raw.goalNodeId);
  if (typeof goalNodeId !== 'undefined') record.goalNodeId = goalNodeId;

  const exitReason = toTrimmedString(raw.exitReason);
  if (exitReason) record.exitReason = exitReason;

  if (Object.keys(metadata).length > 0) {
    record.metadata = metadata;
  }

  return record;
}

function normaliseActivityLog(raw: unknown): JourneyActivityLogRecord | null {
  if (!isRecord(raw)) return null;
  const id = toTrimmedString(raw.id);
  const enrollmentId = toTrimmedString(raw.enrollmentId);
  const timestamp = toTrimmedString(raw.timestamp);
  const eventType = toTrimmedString(raw.eventType);
  if (!id || !enrollmentId || !timestamp || !eventType) return null;

  const log: JourneyActivityLogRecord = {
    id,
    enrollmentId,
    timestamp,
    eventType,
  };

  const data = sanitiseRecord(raw.data);
  if (Object.keys(data).length > 0) {
    log.data = data;
  }

  return log;
}

function normaliseScheduledExecution(raw: unknown): ScheduledExecutionRecord | null {
  if (!isRecord(raw)) return null;

  const id = toTrimmedString(raw.id);
  const journeyId = toTrimmedString(raw.journeyId);
  const enrollmentId = toTrimmedString(raw.enrollmentId);
  const nodeId = toTrimmedString(raw.nodeId);
  const resumeAt = toTrimmedString(raw.resumeAt);
  const status = toExecutionStatus(raw.status);
  const createdAt = toTrimmedString(raw.createdAt);

  if (!id || !journeyId || !enrollmentId || !nodeId || !resumeAt || !status || !createdAt) {
    return null;
  }

  const record: ScheduledExecutionRecord = {
    id,
    journeyId,
    enrollmentId,
    nodeId,
    resumeAt,
    status,
    createdAt,
  };

  const processedAt = toTrimmedString(raw.processedAt);
  if (processedAt) record.processedAt = processedAt;

  const error = toTrimmedString(raw.error);
  if (error) record.error = error;

  const metadata = sanitiseRecord(raw.metadata);
  if (Object.keys(metadata).length > 0) {
    record.metadata = metadata;
  }

  return record;
}

// ─── Journeys (definitions) ─────────────────────────────────────────────────

export async function getJourneys(): Promise<JourneyDefinition[]> {
  const docs = await prisma.journeyDoc.findMany({ orderBy: { updatedAt: 'desc' } });
  return docs.map(doc => doc.data as unknown as JourneyDefinition);
}

export async function getActiveJourneys(): Promise<JourneyDefinition[]> {
  const docs = await prisma.journeyDoc.findMany({ where: { status: 'ACTIVE' } });
  return docs.map(doc => doc.data as unknown as JourneyDefinition);
}

/** Upsert each provided journey (does not delete others). */
export async function saveJourneys(journeys: JourneyDefinition[]): Promise<void> {
  for (const journey of journeys) {
    await updateJourney(journey);
  }
}

export async function updateJourney(journey: JourneyDefinition): Promise<void> {
  if (!journey?.id) return;
  const status = journey.status ?? 'DRAFT';
  const storeId = (journey as { storeId?: string }).storeId ?? '';
  await prisma.journeyDoc.upsert({
    where: { id: journey.id },
    create: { id: journey.id, storeId, status, data: toJson(journey) },
    update: { storeId, status, data: toJson(journey) },
  });
}

export async function deleteJourney(journeyId: string): Promise<void> {
  await prisma.journeyDoc.deleteMany({ where: { id: journeyId } });
}

export async function getJourneyById(journeyId: string): Promise<JourneyDefinition | undefined> {
  const doc = await prisma.journeyDoc.findUnique({ where: { id: journeyId } });
  return doc ? (doc.data as unknown as JourneyDefinition) : undefined;
}

// ─── Enrollments ────────────────────────────────────────────────────────────

export async function getEnrollments(): Promise<JourneyEnrollmentRecord[]> {
  const docs = await prisma.journeyEnrollmentDoc.findMany();
  return docs
    .map(doc => normaliseEnrollment(doc.data))
    .filter((item): item is JourneyEnrollmentRecord => Boolean(item));
}

export async function saveEnrollments(enrollments: JourneyEnrollmentRecord[]): Promise<void> {
  for (const enrollment of enrollments) {
    await updateEnrollmentRecord(enrollment);
  }
}

export async function appendEnrollment(enrollment: JourneyEnrollmentRecord): Promise<void> {
  await updateEnrollmentRecord(enrollment);
}

export async function updateEnrollmentRecord(enrollment: JourneyEnrollmentRecord): Promise<void> {
  const normalised = normaliseEnrollment(enrollment);
  if (!normalised) {
    console.warn('updateEnrollmentRecord: received invalid enrollment payload');
    return;
  }
  await prisma.journeyEnrollmentDoc.upsert({
    where: { id: normalised.id },
    create: {
      id: normalised.id,
      journeyId: normalised.journeyId,
      customerId: normalised.customerId,
      status: normalised.status,
      enteredAt: new Date(normalised.enteredAt),
      data: toJson(normalised),
    },
    update: {
      journeyId: normalised.journeyId,
      customerId: normalised.customerId,
      status: normalised.status,
      data: toJson(normalised),
    },
  });
}

export async function getEnrollmentById(enrollmentId: string): Promise<JourneyEnrollmentRecord | undefined> {
  const doc = await prisma.journeyEnrollmentDoc.findUnique({ where: { id: enrollmentId } });
  return doc ? (normaliseEnrollment(doc.data) ?? undefined) : undefined;
}

export async function getCustomerEnrollments(journeyId: string, customerId: string): Promise<JourneyEnrollmentRecord[]> {
  const docs = await prisma.journeyEnrollmentDoc.findMany({ where: { journeyId, customerId } });
  return docs
    .map(doc => normaliseEnrollment(doc.data))
    .filter((item): item is JourneyEnrollmentRecord => Boolean(item));
}

export async function getLastEnrollment(journeyId: string, customerId: string): Promise<JourneyEnrollmentRecord | undefined> {
  const doc = await prisma.journeyEnrollmentDoc.findFirst({
    where: { journeyId, customerId },
    orderBy: { enteredAt: 'desc' },
  });
  return doc ? (normaliseEnrollment(doc.data) ?? undefined) : undefined;
}

// ─── Activity logs ──────────────────────────────────────────────────────────

export async function getJourneyActivityLogs(): Promise<JourneyActivityLogRecord[]> {
  const docs = await prisma.journeyActivityDoc.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  return docs
    .map(doc => normaliseActivityLog(doc.data))
    .filter((item): item is JourneyActivityLogRecord => Boolean(item));
}

export async function appendJourneyActivity(log: JourneyActivityLogRecord): Promise<void> {
  const normalised = normaliseActivityLog(log);
  if (!normalised) {
    console.warn('appendJourneyActivity: received invalid activity payload');
    return;
  }
  await prisma.journeyActivityDoc.create({
    data: { id: normalised.id, enrollmentId: normalised.enrollmentId, data: toJson(normalised) },
  });
}

// ─── Scheduled executions ───────────────────────────────────────────────────

export async function getScheduledExecutions(): Promise<ScheduledExecutionRecord[]> {
  const docs = await prisma.journeyScheduleDoc.findMany();
  return docs
    .map(doc => normaliseScheduledExecution(doc.data))
    .filter((item): item is ScheduledExecutionRecord => Boolean(item));
}

export async function saveScheduledExecutions(records: ScheduledExecutionRecord[]): Promise<void> {
  for (const record of records) {
    await upsertScheduledExecution(record);
  }
}

export async function addScheduledExecution(record: ScheduledExecutionRecord): Promise<void> {
  await upsertScheduledExecution(record);
}

export async function upsertScheduledExecution(record: ScheduledExecutionRecord): Promise<void> {
  const normalised = normaliseScheduledExecution(record);
  if (!normalised) {
    console.warn('upsertScheduledExecution: received invalid scheduled execution payload');
    return;
  }
  await prisma.journeyScheduleDoc.upsert({
    where: { id: normalised.id },
    create: {
      id: normalised.id,
      journeyId: normalised.journeyId,
      enrollmentId: normalised.enrollmentId,
      nodeId: normalised.nodeId,
      status: normalised.status,
      resumeAt: new Date(normalised.resumeAt),
      data: toJson(normalised),
    },
    update: {
      status: normalised.status,
      resumeAt: new Date(normalised.resumeAt),
      data: toJson(normalised),
    },
  });
}

export async function getDueScheduledExecutions(nowIso: string): Promise<ScheduledExecutionRecord[]> {
  const nowMs = safeDateParse(nowIso);
  if (nowMs === undefined) return [];
  const docs = await prisma.journeyScheduleDoc.findMany({
    where: { status: 'pending', resumeAt: { lte: new Date(nowMs) } },
  });
  return docs
    .map(doc => normaliseScheduledExecution(doc.data))
    .filter((item): item is ScheduledExecutionRecord => Boolean(item));
}

export async function cancelScheduledExecutionsForEnrollment(enrollmentId: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const docs = await prisma.journeyScheduleDoc.findMany({ where: { enrollmentId, status: 'pending' } });
  for (const doc of docs) {
    const record = normaliseScheduledExecution(doc.data);
    if (!record) continue;
    const updated = { ...record, status: 'cancelled' as const, processedAt: timestamp };
    await prisma.journeyScheduleDoc.update({
      where: { id: doc.id },
      data: { status: 'cancelled', data: toJson(updated) },
    });
  }
}

export async function markScheduledExecution(recordId: string, status: ScheduledExecutionRecord['status'], error?: string): Promise<void> {
  const statusNormalised = toExecutionStatus(status);
  if (!statusNormalised) {
    console.warn('markScheduledExecution: invalid status payload', status);
    return;
  }
  const doc = await prisma.journeyScheduleDoc.findUnique({ where: { id: recordId } });
  if (!doc) return;
  const record = normaliseScheduledExecution(doc.data);
  if (!record) return;
  const updated = {
    ...record,
    status: statusNormalised,
    processedAt: new Date().toISOString(),
    error: error ? error : record.error,
  };
  await prisma.journeyScheduleDoc.update({
    where: { id: recordId },
    data: { status: statusNormalised, data: toJson(updated) },
  });
}
