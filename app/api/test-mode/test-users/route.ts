export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { TestUser } from '@/lib/types/test-mode';
import { testUserStore } from '@/app/api/journeys/mock-stores';

function getOrInitTestUsers(journeyId: string): TestUser[] {
  const existing = testUserStore.get(journeyId);
  if (existing) {
    return existing;
  }
  const seed: TestUser[] = [];
  testUserStore.set(journeyId, seed);
  return seed;
}

function parseJourneyId(request: NextRequest, bodyJourneyId?: string | null): string | null {
  const { searchParams } = new URL(request.url);
  const paramId = searchParams.get('journeyId');
  return (bodyJourneyId ?? paramId)?.trim() || null;
}

export async function GET(request: NextRequest) {
  const journeyId = parseJourneyId(request);
  if (!journeyId) {
    return NextResponse.json({ error: 'journeyId is required' }, { status: 400 });
  }

  return NextResponse.json({
    journeyId,
    testUsers: getOrInitTestUsers(journeyId),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const journeyId = parseJourneyId(request, body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId is required' }, { status: 400 });
    }

    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!phone && !email) {
      return NextResponse.json({ error: 'Provide a phone number or email.' }, { status: 400 });
    }

    const testUsers = getOrInitTestUsers(journeyId);
    const next: TestUser = {
      id: `test_user_${Math.random().toString(36).slice(2)}`,
      phone,
      email: email || undefined,
      name: name || undefined,
      addedAt: new Date().toISOString(),
    };

    testUserStore.set(journeyId, [...testUsers, next]);

    return NextResponse.json({ success: true, journeyId, testUser: next });
  } catch (error) {
    console.error('[test-mode][test-users][POST]', error);
    return NextResponse.json({ error: 'Failed to add test user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const journeyId = parseJourneyId(request, body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'journeyId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId') ?? (typeof body?.userId === 'string' ? body.userId : null);

    if (!userIdParam || userIdParam === 'all') {
      testUserStore.set(journeyId, []);
      return NextResponse.json({ success: true, journeyId, cleared: true });
    }

    const existing = getOrInitTestUsers(journeyId);
    testUserStore.set(
      journeyId,
      existing.filter(user => user.id !== userIdParam),
    );

    return NextResponse.json({ success: true, journeyId, removedUserId: userIdParam });
  } catch (error) {
    console.error('[test-mode][test-users][DELETE]', error);
    return NextResponse.json({ error: 'Failed to remove test user' }, { status: 500 });
  }
}

