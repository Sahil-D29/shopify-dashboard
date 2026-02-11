import fs from 'fs';

import { getDataFilePath, readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

import type { JourneyDefinition } from '@/lib/types/journey';

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

const JOURNEYS_FILE = 'journeys.json';
const ENROLLMENTS_FILE = 'journey-enrollments.json';
const ACTIVITY_LOG_FILE = 'journey-activity-log.json';
const SCHEDULE_FILE = 'scheduled-executions.json';

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

function readRecords<T>(file: string, normalise: (raw: unknown) => T | null): T[] {
  const raw = readJsonFile<unknown>(file);
  if (!Array.isArray(raw)) {
    return [];
  }
  const records: T[] = [];
  raw.forEach(item => {
    const normalised = normalise(item);
    if (normalised) {
      records.push(normalised);
    }
  });
  return records;
}

function writeRecords<T>(file: string, records: T[]): void {
  writeJsonFile<T>(file, records);
}

export function getJourneys(): JourneyDefinition[] {
  return readJsonFile<JourneyDefinition>(JOURNEYS_FILE);
}

export function getActiveJourneys(): JourneyDefinition[] {
  return getJourneys().filter(journey => journey.status === 'ACTIVE');
}

export function saveJourneys(journeys: JourneyDefinition[]): void {
  writeJsonFile<JourneyDefinition>(JOURNEYS_FILE, journeys);
}

export function updateJourney(journey: JourneyDefinition): void {
  const journeys = getJourneys();
  const idx = journeys.findIndex(item => item.id === journey.id);
  if (idx === -1) journeys.push(journey);
  else journeys[idx] = journey;
  saveJourneys(journeys);
}

export function getEnrollments(): JourneyEnrollmentRecord[] {
  return readRecords(ENROLLMENTS_FILE, normaliseEnrollment);
}

export function saveEnrollments(enrollments: JourneyEnrollmentRecord[]): void {
  const sanitised = enrollments.map(normaliseEnrollment).filter((item): item is JourneyEnrollmentRecord => Boolean(item));
  try {
    const serialised = JSON.stringify(sanitised, null, 2);
    JSON.parse(serialised);
    writeRecords(ENROLLMENTS_FILE, sanitised);
  } catch (error) {
    const backupPath = `${getDataFilePath(ENROLLMENTS_FILE)}.${Date.now()}.backup`;
    try {
      fs.writeFileSync(backupPath, JSON.stringify(sanitised, null, 2), 'utf-8');
    } catch (backupError) {
      console.error('Failed to write enrollments backup:', backupError);
    }
    console.error('Failed to save enrollments:', error);
    throw error;
  }
}

export function appendEnrollment(enrollment: JourneyEnrollmentRecord): void {
  const normalised = normaliseEnrollment(enrollment);
  if (!normalised) {
    console.warn('appendEnrollment: received invalid enrollment payload');
    return;
  }
  const enrollments = getEnrollments();
  enrollments.unshift(normalised);
  saveEnrollments(enrollments);
}

export function updateEnrollmentRecord(enrollment: JourneyEnrollmentRecord): void {
  const normalised = normaliseEnrollment(enrollment);
  if (!normalised) {
    console.warn('updateEnrollmentRecord: received invalid enrollment payload');
    return;
  }
  const enrollments = getEnrollments();
  const idx = enrollments.findIndex(item => item.id === normalised.id);
  if (idx === -1) {
    enrollments.unshift(normalised);
  } else {
    enrollments[idx] = normalised;
  }
  saveEnrollments(enrollments);
}

export function getEnrollmentById(enrollmentId: string): JourneyEnrollmentRecord | undefined {
  return getEnrollments().find(item => item.id === enrollmentId);
}

export function getCustomerEnrollments(journeyId: string, customerId: string): JourneyEnrollmentRecord[] {
  return getEnrollments().filter(item => item.journeyId === journeyId && item.customerId === customerId);
}

export function getLastEnrollment(journeyId: string, customerId: string): JourneyEnrollmentRecord | undefined {
  return getEnrollments()
    .filter(item => item.journeyId === journeyId && item.customerId === customerId)
    .sort((a, b) => (safeDateParse(b.enteredAt) ?? 0) - (safeDateParse(a.enteredAt) ?? 0))[0];
}

export function getJourneyActivityLogs(): JourneyActivityLogRecord[] {
  return readRecords(ACTIVITY_LOG_FILE, normaliseActivityLog);
}

export function appendJourneyActivity(log: JourneyActivityLogRecord): void {
  const normalised = normaliseActivityLog(log);
  if (!normalised) {
    console.warn('appendJourneyActivity: received invalid activity payload');
    return;
  }
  const logs = getJourneyActivityLogs();
  logs.unshift(normalised);
  const MAX_LOGS = 500;
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }
  writeRecords(ACTIVITY_LOG_FILE, logs);
}

export function getScheduledExecutions(): ScheduledExecutionRecord[] {
  return readRecords(SCHEDULE_FILE, normaliseScheduledExecution);
}

export function saveScheduledExecutions(records: ScheduledExecutionRecord[]): void {
  const sanitised = records.map(normaliseScheduledExecution).filter((item): item is ScheduledExecutionRecord => Boolean(item));
  writeRecords(SCHEDULE_FILE, sanitised);
}

export function addScheduledExecution(record: ScheduledExecutionRecord): void {
  const normalised = normaliseScheduledExecution(record);
  if (!normalised) {
    console.warn('addScheduledExecution: received invalid scheduled execution payload');
    return;
  }
  const records = getScheduledExecutions();
  records.push(normalised);
  saveScheduledExecutions(records);
}

export function upsertScheduledExecution(record: ScheduledExecutionRecord): void {
  const normalised = normaliseScheduledExecution(record);
  if (!normalised) {
    console.warn('upsertScheduledExecution: received invalid scheduled execution payload');
    return;
  }
  const records = getScheduledExecutions();
  const idx = records.findIndex(item => item.id === normalised.id);
  if (idx === -1) records.push(normalised);
  else records[idx] = normalised;
  saveScheduledExecutions(records);
}

export function getDueScheduledExecutions(nowIso: string): ScheduledExecutionRecord[] {
  const nowMs = safeDateParse(nowIso);
  if (nowMs === undefined) {
    return [];
  }
  return getScheduledExecutions().filter(record => {
    const resumeAt = safeDateParse(record.resumeAt);
    return record.status === 'pending' && resumeAt !== undefined && resumeAt <= nowMs;
  });
}

export function cancelScheduledExecutionsForEnrollment(enrollmentId: string): void {
  const records = getScheduledExecutions().map(record => ({ ...record }));
  const timestamp = new Date().toISOString();
  const updated = records.map(record =>
    record.enrollmentId === enrollmentId && record.status === 'pending'
      ? { ...record, status: 'cancelled', processedAt: timestamp }
      : record,
  );
  saveScheduledExecutions(updated as ScheduledExecutionRecord[]);
}

export function markScheduledExecution(recordId: string, status: ScheduledExecutionRecord['status'], error?: string): void {
  const statusNormalised = toExecutionStatus(status);
  if (!statusNormalised) {
    console.warn('markScheduledExecution: invalid status payload', status);
    return;
  }
  const records = getScheduledExecutions().map(record =>
    record.id === recordId
      ? {
          ...record,
          status: statusNormalised,
          processedAt: new Date().toISOString(),
          error: error ? error : record.error,
        }
      : record,
  );
  saveScheduledExecutions(records);
}

export function getJourneyById(journeyId: string): JourneyDefinition | undefined {
  return getJourneys().find(journey => journey.id === journeyId);
}
