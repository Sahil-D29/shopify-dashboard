/**
 * Logger - activity and error logging using Prisma
 * Replaces backend utils/logger.js
 */
import { prisma } from './prisma';

export interface ActivityLogEntry {
  userId?: string | null;
  storeId?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ErrorLogEntry {
  message: string;
  stack?: string;
  type?: string;
  context?: Record<string, unknown>;
  userId?: string | null;
  storeId?: string | null;
}

export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: entry.userId ?? undefined,
        storeId: entry.storeId ?? undefined,
        action: entry.action,
        resource: entry.resource ?? undefined,
        resourceId: entry.resourceId ?? undefined,
        details: (entry.details ?? undefined) as object | undefined,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent ?? undefined,
      },
    });
  } catch (error) {
    console.error('logActivity failed:', error);
  }
}

export async function logError(entry: ErrorLogEntry | string): Promise<void> {
  const message = typeof entry === 'string' ? entry : entry.message;
  const stack = typeof entry === 'string' ? undefined : entry.stack;
  const context = typeof entry === 'string' ? undefined : entry.context;
  const type = typeof entry === 'string' ? undefined : entry.type;
  const userId = typeof entry === 'string' ? undefined : entry.userId;
  const storeId = typeof entry === 'string' ? undefined : entry.storeId;

  try {
    await prisma.errorLog.create({
      data: {
        message,
        stack: stack ?? undefined,
        context: (context ?? undefined) as object | undefined,
        userId: userId ?? undefined,
        storeId: storeId ?? undefined,
      },
    });
  } catch (dbError) {
    console.error('logError (db):', dbError);
    console.error('logError entry:', type ?? 'error', message, stack);
  }
}
