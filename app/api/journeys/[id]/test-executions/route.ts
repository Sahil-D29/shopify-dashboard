export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { JourneyExecutionLog, TestUser } from '@/lib/types/test-mode';
import { executionLogStore, testUserStore } from '@/app/api/journeys/mock-stores';

function getTestUsers(journeyId: string): TestUser[] {
  return testUserStore.get(journeyId) ?? [];
}

function getExecutionLogs(journeyId: string): JourneyExecutionLog[] {
  return executionLogStore.get(journeyId) ?? [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const logs = getExecutionLogs(id);
    const users = getTestUsers(id);

    const progress = users.map(user => {
      const userLogs = logs.filter(log => log.testUserId === user.id);
      if (userLogs.length === 0) {
        return {
          testUser: user,
          currentNode: 'Not triggered',
          status: 'waiting' as const,
          lastActionAt: user.addedAt,
        };
      }
      const lastLog = userLogs[userLogs.length - 1];
      return {
        testUser: user,
        currentNode: lastLog.nodeName,
        status:
          lastLog.status === 'completed'
            ? ('completed' as const)
            : lastLog.status === 'failed'
              ? ('failed' as const)
              : ('running' as const),
        lastActionAt: lastLog.timestamp,
      };
    });

    return NextResponse.json({
      journeyId: id,
      progress,
      logs,
    });
  } catch (error) {
    console.error('[test-executions][GET]', error);
    return NextResponse.json({ error: 'Failed to fetch test executions.' }, { status: 500 });
  }
}



