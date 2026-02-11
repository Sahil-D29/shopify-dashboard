import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({
      journeyId: id,
      testUsers: getTestUsers(id),
    });
  } catch (error) {
    console.error('[test-users][GET]', error);
    return NextResponse.json({ error: 'Failed to fetch test users.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { phone, email, name } = body ?? {};
    if (!phone && !email) {
      return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
    }
    const trimmedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : undefined;
    const trimmedEmail = typeof email === 'string' && email.trim() ? email.trim() : undefined;

    const next: TestUser = {
      id: `test_user_${Math.random().toString(36).slice(2)}`,
      phone: trimmedPhone ?? '',
      email: trimmedEmail,
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      addedAt: new Date().toISOString(),
    };

    const existing = getTestUsers(id);
    testUserStore.set(id, [...existing, next]);
    return NextResponse.json({ success: true, testUser: next });
  } catch (error) {
    console.error('[test-users][POST]', error);
    return NextResponse.json({ error: 'Failed to add test user.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    testUserStore.set(id, []);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[test-users][DELETE]', error);
    return NextResponse.json({ error: 'Failed to clear test users.' }, { status: 500 });
  }
}



