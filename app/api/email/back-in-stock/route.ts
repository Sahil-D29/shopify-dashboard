export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

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

interface CreatePayload {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  productTitle?: string;
  productImage?: string | null;
  productUrl?: string | null;
  variantTitle?: string | null;
  source?: string;
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', subscriptions: [] },
        { status: 401 },
      );
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const url = request.nextUrl;
    const status = url.searchParams.get('status');
    const productId = url.searchParams.get('productId');
    const variantId = url.searchParams.get('variantId');
    const limit = parseInt32(url.searchParams.get('limit'), 50);
    const offset = parseInt32(url.searchParams.get('offset'), 0, 10_000);

    const where: any = storeFilter.allowAll
      ? {}
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId }
        : { storeId: '__none__' };
    if (status && ['PENDING', 'NOTIFIED', 'CANCELLED'].includes(status)) where.status = status;
    if (productId) where.shopifyProductId = productId;
    if (variantId) where.shopifyVariantId = variantId;

    const [subscriptions, total, statusCounts, productGroups] = await Promise.all([
      prisma.backInStockSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.backInStockSubscription.count({ where }),
      prisma.backInStockSubscription.groupBy({
        by: ['status'],
        where: storeFilter.allowAll ? {} : { storeId: storeFilter.storeId },
        _count: { _all: true },
      }),
      prisma.backInStockSubscription.groupBy({
        by: ['shopifyProductId', 'productTitle', 'productImage'],
        where: storeFilter.allowAll
          ? { status: 'PENDING' }
          : { storeId: storeFilter.storeId, status: 'PENDING' },
        _count: { _all: true },
        orderBy: { _count: { shopifyProductId: 'desc' } },
        take: 20,
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) counts[row.status] = row._count._all;

    return NextResponse.json({
      success: true,
      subscriptions,
      total,
      limit,
      offset,
      counts,
      productGroups: productGroups.map(g => ({
        shopifyProductId: g.shopifyProductId,
        productTitle: g.productTitle,
        productImage: g.productImage,
        pendingCount: g._count._all,
      })),
    });
  } catch (error) {
    console.error('[BackInStock][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load subscriptions',
        details: getErrorMessage(error),
        subscriptions: [],
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

    let body: CreatePayload;
    try {
      body = (await request.json()) as CreatePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }
    if (!body.shopifyProductId?.trim() || !body.shopifyVariantId?.trim()) {
      return NextResponse.json(
        { error: 'shopifyProductId and shopifyVariantId are required' },
        { status: 400 },
      );
    }
    if (!body.productTitle?.trim()) {
      return NextResponse.json({ error: 'productTitle is required' }, { status: 400 });
    }

    try {
      const sub = await prisma.backInStockSubscription.create({
        data: {
          storeId,
          email,
          firstName: body.firstName?.trim() || null,
          lastName: body.lastName?.trim() || null,
          shopifyProductId: body.shopifyProductId.trim(),
          shopifyVariantId: body.shopifyVariantId.trim(),
          productTitle: body.productTitle.trim(),
          productImage: body.productImage ?? null,
          productUrl: body.productUrl ?? null,
          variantTitle: body.variantTitle ?? null,
          source: body.source ?? 'DASHBOARD',
        },
      });
      return NextResponse.json({ success: true, subscription: sub }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'This customer is already subscribed for this variant' },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('[BackInStock][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
