export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

import type { TestUser } from '@/lib/types/test-mode';
import { testUserStore } from '@/app/api/journeys/mock-stores';

function getTestUsers(journeyId: string): TestUser[] {
  const list = testUserStore.get(journeyId);
  if (!list) {
    const initial: TestUser[] = [
      {
        id: `test_${journeyId}_alice`,
        phone: '+15555551000',
        email: 'alice@example.com',
        name: 'Alice Example',
        addedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ];
    testUserStore.set(journeyId, initial);
    return initial;
  }
  return list;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; testUserId: string }> },
) {
  const { id, testUserId } = await params;
  const existing = getTestUsers(id);
  const next = existing.filter(user => user.id !== testUserId);
  testUserStore.set(id, next);
  return NextResponse.json({ success: true });
}



