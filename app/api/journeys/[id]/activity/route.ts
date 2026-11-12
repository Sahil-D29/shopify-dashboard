export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function parseLimit(value: string | null): number {
  const fallback = 50;
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 250);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = (await params);
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const journey = await prisma.journeyDoc.findFirst({ where: { id: resolved.id, storeId }, select: { id: true } });
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const sinceParam = searchParams.get('since');
    const sinceMs = sinceParam ? Date.parse(sinceParam) : undefined;

    const docs = await prisma.journeyEnrollmentDoc.findMany({ where: { journeyId: resolved.id }, select: { id: true, data: true } });
    const enrollments = docs.map(doc => doc.data as any);
    const enrollmentIds = new Set(enrollments.map(enrollment => enrollment.id));
    const enrollmentLookup = new Map(enrollments.map(enrollment => [enrollment.id, enrollment]));

    const activityDocs = enrollmentIds.size ? await prisma.journeyActivityDoc.findMany({
      where: { enrollmentId: { in: Array.from(enrollmentIds) } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) : [];
    const logs = activityDocs
      .map(doc => doc.data as any)
      .filter(log => {
        if (sinceMs === undefined) return true;
        const timestamp = Date.parse(log.timestamp);
        return Number.isFinite(timestamp) && timestamp >= sinceMs;
      })
      .slice(0, limit)
      .map(log => {
        const enrollment = log.enrollmentId ? enrollmentLookup.get(log.enrollmentId) : undefined;
        return {
          id: log.id,
          enrollmentId: log.enrollmentId,
          timestamp: log.timestamp,
          eventType: log.eventType,
          data: log.data,
          customerEmail: enrollment?.customerEmail,
          customerPhone: enrollment?.customerPhone,
        };
      });

    return NextResponse.json({ data: logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load activity';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

