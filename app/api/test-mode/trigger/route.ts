export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { JourneyExecutionLog, TestUser } from '@/lib/types/test-mode';
import { executionLogStore, testUserStore } from '@/app/api/journeys/mock-stores';

function getTestUsers(journeyId: string): TestUser[] {
  return testUserStore.get(journeyId) ?? [];
}

function appendExecutionLog(journeyId: string, entries: JourneyExecutionLog[]) {
  const existing = executionLogStore.get(journeyId) ?? [];
  executionLogStore.set(journeyId, [...existing, ...entries]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const journeyId = typeof body?.journeyId === 'string' ? body.journeyId.trim() : '';
    const testUserId = typeof body?.testUserId === 'string' ? body.testUserId.trim() : '';

    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId is required' }, { status: 400 });
    }
    if (!testUserId) {
      return NextResponse.json({ error: 'testUserId is required' }, { status: 400 });
    }

    const users = getTestUsers(journeyId);
    const user = users.find(candidate => candidate.id === testUserId);
    if (!user) {
      return NextResponse.json({ error: 'Test user not found' }, { status: 404 });
    }

    const now = Date.now();
    appendExecutionLog(journeyId, [
      {
        testUserId,
        nodeId: 'trigger_start',
        nodeName: 'Journey Trigger',
        timestamp: new Date(now).toISOString(),
        status: 'entered',
        details: 'User manually triggered into journey.',
      },
      {
        testUserId,
        nodeId: 'goal_conversion',
        nodeName: 'Journey Goal',
        timestamp: new Date(now + 30_000).toISOString(),
        status: 'completed',
        details: 'Goal achieved during test execution.',
      },
    ]);

    return NextResponse.json({ success: true, journeyId, testUserId });
  } catch (error) {
    console.error('[test-mode][trigger][POST]', error);
    return NextResponse.json({ error: 'Failed to trigger journey' }, { status: 500 });
  }
}

