export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import {
  getEnrollments,
  getJourneyActivityLogs,
} from '@/lib/journey-engine/storage';

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
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const sinceParam = searchParams.get('since');
    const sinceMs = sinceParam ? Date.parse(sinceParam) : undefined;

    const enrollments = getEnrollments().filter(enrollment => enrollment.journeyId === resolved.id);
    const enrollmentIds = new Set(enrollments.map(enrollment => enrollment.id));
    const enrollmentLookup = new Map(enrollments.map(enrollment => [enrollment.id, enrollment]));

    const logs = getJourneyActivityLogs()
      .filter(log => {
        if (log.data?.journeyId === resolved.id) return true;
        return Boolean(log.enrollmentId && enrollmentIds.has(log.enrollmentId));
      })
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

