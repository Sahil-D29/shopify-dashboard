export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const VALID_STATUSES = new Set([
  'SUBSCRIBED',
  'UNSUBSCRIBED',
  'BOUNCED',
  'COMPLAINED',
  'PENDING',
]);

interface CreateSubscriberPayload {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string;
  tags?: string[];
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseInt32 = (value: string | null, fallback: number, max = 200): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', subscribers: [], total: 0 },
        { status: 401 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    if (!storeFilter.allowAll && !storeFilter.storeId) {
      return NextResponse.json(
        { success: false, error: 'Store context required', subscribers: [], total: 0 },
        { status: 200 },
      );
    }

    const url = request.nextUrl;
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const status = url.searchParams.get('status');
    const limit = parseInt32(url.searchParams.get('limit'), 50);
    const offset = parseInt32(url.searchParams.get('offset'), 0, 10_000);

    const where: any = storeFilter.allowAll ? {} : { storeId: storeFilter.storeId };
    if (status && VALID_STATUSES.has(status)) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [subscribers, total, statusCounts] = await Promise.all([
      prisma.emailSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.emailSubscriber.count({ where }),
      prisma.emailSubscriber.groupBy({
        by: ['status'],
        where: storeFilter.allowAll ? {} : { storeId: storeFilter.storeId },
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row._count._all;
    }

    return NextResponse.json({
      success: true,
      subscribers,
      total,
      limit,
      offset,
      counts,
    });
  } catch (error) {
    console.error('[Email Subscribers][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load subscribers',
        details: getErrorMessage(error),
        subscribers: [],
        total: 0,
      },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    let storeId: string | null;
    if (storeFilter.allowAll) {
      storeId = requestedStoreId || userContext.storeId || null;
    } else {
      storeId = storeFilter.storeId || null;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    let body: CreateSubscriberPayload;
    try {
      body = (await request.json()) as CreateSubscriberPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const status =
      body.status && VALID_STATUSES.has(body.status) ? body.status : 'SUBSCRIBED';

    try {
      const subscriber = await prisma.emailSubscriber.create({
        data: {
          storeId,
          email,
          firstName: body.firstName?.trim() || null,
          lastName: body.lastName?.trim() || null,
          status: status as any,
          source: 'MANUAL',
          tags: Array.isArray(body.tags) ? body.tags : [],
        },
      });
      return NextResponse.json({ success: true, subscriber }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'A subscriber with this email already exists for this store' },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('[Email Subscribers][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscriber', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
