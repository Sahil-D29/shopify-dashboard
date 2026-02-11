import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * NOTE: This module is now **database-backed** via Prisma.
 * It exists for compatibility with older call sites that used JSON storage.
 */
export interface Segment {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  filters: Prisma.JsonValue;
  customerCount?: number;
  isActive?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

const toPublicSegment = (row: any): Segment => ({
  id: row.id,
  storeId: row.storeId,
  name: row.name,
  description: row.description,
  filters: row.filters,
  customerCount: row.customerCount ?? 0,
  isActive: row.isActive ?? true,
  createdBy: row.createdBy,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
});

/**
 * Load segments from database.
 * If `storeId` is provided, results are scoped to that store.
 */
export async function loadSegments(storeId?: string): Promise<Segment[]> {
  const rows = await prisma.segment.findMany({
    where: storeId ? { storeId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublicSegment);
}

/**
 * Legacy bulk-save API (JSON-era). Intentionally removed.
 * Use `createSegment` / `updateSegment` instead.
 */
export async function saveSegments(): Promise<void> {
  throw new Error('saveSegments() is deprecated. Use Prisma create/update operations instead.');
}

/**
 * Get segment by ID (optionally scoped to `storeId`).
 */
export async function getSegmentById(id: string, storeId?: string): Promise<Segment | null> {
  const row = await prisma.segment.findFirst({
    where: storeId ? { id, storeId } : { id },
  });
  return row ? toPublicSegment(row) : null;
}

/**
 * Create segment (database).
 */
export async function createSegment(input: {
  storeId: string;
  name: string;
  description?: string | null;
  filters: Prisma.InputJsonValue;
  createdBy: string;
  customerCount?: number;
  isActive?: boolean;
}): Promise<Segment> {
  const row = await prisma.segment.create({
    data: {
      storeId: input.storeId,
      name: input.name,
      description: input.description ?? null,
      filters: input.filters,
      createdBy: input.createdBy,
      customerCount: input.customerCount ?? 0,
      isActive: input.isActive ?? true,
    },
  });
  return toPublicSegment(row);
}

/**
 * Update segment (database).
 */
export async function updateSegment(
  id: string,
  updates: {
    storeId?: string;
    name?: string;
    description?: string | null;
    filters?: Prisma.InputJsonValue;
    customerCount?: number;
    isActive?: boolean;
  },
): Promise<Segment | null> {
  const row = await prisma.segment.findFirst({
    where: updates.storeId ? { id, storeId: updates.storeId } : { id },
  });
  if (!row) return null;

  const next = await prisma.segment.update({
    where: { id: row.id },
    data: {
      name: updates.name,
      description: updates.description,
      filters: updates.filters,
      customerCount: updates.customerCount,
      isActive: updates.isActive,
    },
  });
  return toPublicSegment(next);
}

/**
 * Delete segment (database).
 */
export async function deleteSegment(id: string, storeId?: string): Promise<boolean> {
  const row = await prisma.segment.findFirst({
    where: storeId ? { id, storeId } : { id },
    select: { id: true },
  });
  if (!row) return false;

  await prisma.segment.delete({ where: { id: row.id } });
  return true;
}


