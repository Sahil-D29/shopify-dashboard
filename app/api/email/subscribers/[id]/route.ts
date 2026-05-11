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

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function loadAccessible(
  request: NextRequest,
  id: string,
): Promise<
  | { ok: true; storeFilter: { allowAll: boolean; storeId?: string }; subscriber: any }
  | { ok: false; response: NextResponse }
> {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  const requestedStoreId = await getCurrentStoreId(request);
  const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

  const subscriber = await prisma.emailSubscriber.findUnique({ where: { id } });
  if (!subscriber) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Subscriber not found' }, { status: 404 }),
    };
  }
  if (!storeFilter.allowAll && subscriber.storeId !== storeFilter.storeId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    };
  }
  return { ok: true, storeFilter, subscriber };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;
    return NextResponse.json({ success: true, subscriber: result.subscriber });
  } catch (error) {
    console.error('[Email Subscribers][GET id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load subscriber', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.firstName === 'string' || body.firstName === null) {
      data.firstName = body.firstName?.trim() || null;
    }
    if (typeof body.lastName === 'string' || body.lastName === null) {
      data.lastName = body.lastName?.trim() || null;
    }
    if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
      data.status = body.status;
      if (body.status === 'UNSUBSCRIBED' && !result.subscriber.unsubscribedAt) {
        data.unsubscribedAt = new Date();
      }
    }
    if (Array.isArray(body.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === 'string');
    }
    if (typeof body.suppressionReason === 'string' || body.suppressionReason === null) {
      data.suppressionReason = body.suppressionReason ?? null;
    }

    const subscriber = await prisma.emailSubscriber.update({ where: { id }, data });
    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    console.error('[Email Subscribers][PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscriber', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;
    await prisma.emailSubscriber.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Subscribers][DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscriber', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
