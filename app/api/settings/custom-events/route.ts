export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { isValidEventName, isBuiltInEvent } from '@/lib/custom-events/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

    const events = await prisma.customEventDefinition.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error('[Custom Events] List error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

    const body = await request.json();

    const displayName = body.displayName?.trim();
    if (!displayName || displayName.length < 1 || displayName.length > 100) {
      return NextResponse.json(
        { error: 'displayName is required (1-100 characters)' },
        { status: 400 }
      );
    }

    // Auto-generate slug from displayName or use provided eventName
    const eventName = (body.eventName || displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')).trim();

    if (!isValidEventName(eventName)) {
      return NextResponse.json(
        { error: 'eventName must be 3-50 chars, lowercase alphanumeric with underscores, starting with a letter' },
        { status: 400 }
      );
    }

    if (isBuiltInEvent(eventName)) {
      return NextResponse.json(
        { error: `'${eventName}' conflicts with a built-in event name` },
        { status: 409 }
      );
    }

    // Check uniqueness
    const existing = await prisma.customEventDefinition.findUnique({
      where: { storeId_eventName: { storeId, eventName } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Event '${eventName}' already exists for this store` },
        { status: 409 }
      );
    }

    // Validate properties array
    const properties = Array.isArray(body.properties) ? body.properties : [];

    const event = await prisma.customEventDefinition.create({
      data: {
        storeId,
        eventName,
        displayName,
        description: body.description || null,
        category: body.category || 'custom',
        properties,
      },
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('[Custom Events] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
