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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { testUserId } = body ?? {};
    if (!testUserId) {
      return NextResponse.json({ error: 'testUserId is required.' }, { status: 400 });
    }

    const users = getTestUsers(id);
    const user = users.find(item => item.id === testUserId);
    if (!user) {
      return NextResponse.json({ error: 'Test user not found.' }, { status: 404 });
    }

    const now = Date.now();
    appendExecutionLog(id, [
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
        timestamp: new Date(now + 1000 * 30).toISOString(),
        status: 'completed',
        details: 'Goal achieved during test execution.',
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[test-trigger][POST]', error);
    return NextResponse.json({ error: 'Unable to trigger test user.' }, { status: 500 });
  }
}



