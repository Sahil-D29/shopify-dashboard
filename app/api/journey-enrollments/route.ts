export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyEnrollment } from '@/lib/types/journey';
import { requireStoreAccess, filterByStoreId, ensureStoreId } from '@/lib/tenant/api-helpers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected server error';

interface CreateEnrollmentPayload {
  id?: string;
  journeyId?: string;
  customerId?: string;
  currentNodeId?: string | null;
  history?: JourneyEnrollment['history'];
  actions?: JourneyEnrollment['actions'];
}

function normalisePayload(payload: CreateEnrollmentPayload): JourneyEnrollment | null {
  if (!payload.journeyId || !payload.customerId) {
    return null;
  }

  const now = Date.now();
  return {
    id: payload.id && payload.id.trim().length > 0 ? payload.id : uuid(),
    journeyId: payload.journeyId,
    customerId: payload.customerId,
    status: 'ACTIVE',
    currentNodeId: payload.currentNodeId ?? undefined,
    history: Array.isArray(payload.history) ? payload.history : [],
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    startedAt: now,
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Require store access
    const storeId = await requireStoreAccess(request);
    
    let enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
    
    // Filter by store
    enrollments = filterByStoreId(enrollments, storeId);
    
    return NextResponse.json({ enrollments });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require store access
    const storeId = await requireStoreAccess(request);
    
    const body = (await request.json()) as CreateEnrollmentPayload;
    const enrollment = normalisePayload(body);
    if (!enrollment) {
      return NextResponse.json(
        { error: 'journeyId and customerId are required' },
        { status: 400 },
      );
    }

    const enrollments = readJsonFile<JourneyEnrollment>('journey-enrollments.json');
    // Ensure storeId is added
    const enrollmentWithStore = ensureStoreId(enrollment, storeId);
    enrollments.push(enrollmentWithStore);
    writeJsonFile('journey-enrollments.json', enrollments);
    return NextResponse.json({ enrollment: enrollmentWithStore }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


