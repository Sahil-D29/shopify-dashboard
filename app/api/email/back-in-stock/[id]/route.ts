export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function loadAccessible(request: NextRequest, id: string) {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const requestedStoreId = await getCurrentStoreId(request);
  const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
  const sub = await prisma.backInStockSubscription.findUnique({ where: { id } });
  if (!sub) {
    return { ok: false as const, response: NextResponse.json({ error: 'Subscription not found' }, { status: 404 }) };
  }
  if (!storeFilter.allowAll && sub.storeId !== storeFilter.storeId) {
    return { ok: false as const, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }
  return { ok: true as const, subscription: sub };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadAccessible(request, id);
  if (!result.ok) return result.response;
  return NextResponse.json({ success: true, subscription: result.subscription });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;
    await prisma.backInStockSubscription.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
