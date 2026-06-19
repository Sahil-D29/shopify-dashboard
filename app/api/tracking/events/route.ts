import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

/**
 * Normalize the free-form metadata into a known shape so segment sub-filters
 * (product tags / type / vendor / price, collection title) can evaluate reliably.
 * Unknown keys are preserved.
 */
function normalizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  const tagsRaw = m.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map(t => String(t).trim()).filter(Boolean)
    : typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;
  return {
    ...m,
    ...(tags ? { tags } : {}),
    ...(m.productType ?? m.product_type ? { productType: String(m.productType ?? m.product_type) } : {}),
    ...(m.vendor != null ? { vendor: String(m.vendor) } : {}),
    ...(m.price != null ? { price: Number(m.price) || 0 } : {}),
    ...(m.title != null ? { title: String(m.title) } : {}),
    ...(m.collectionTitle != null ? { collectionTitle: String(m.collectionTitle) } : {}),
  };
}

/**
 * Public POST endpoint for storefront tracking events.
 * Called by the tracking.js snippet embedded in Shopify themes.
 * No auth required — validated by storeId existence.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId, customerId, sessionId, eventType, resourceId, resourceTitle, metadata } = body;

    if (!storeId || !sessionId || !eventType) {
      return json(
        { error: 'Missing required fields: storeId, sessionId, eventType' },
        400
      );
    }

    const validEventTypes = [
      'product_viewed', 'product_added_to_cart', 'collection_viewed',
      'product_removed_from_cart', 'search_submitted', 'active_on_site',
    ];
    if (!validEventTypes.includes(eventType)) {
      return json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        400
      );
    }

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      return json({ error: 'Invalid storeId' }, 404);
    }

    await prisma.storefrontEvent.create({
      data: {
        storeId,
        customerId: customerId || null,
        sessionId,
        eventType,
        resourceId: resourceId || null,
        resourceTitle: resourceTitle || null,
        metadata: (normalizeMetadata(metadata) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    return json({ success: true });
  } catch (error) {
    console.error('[Tracking] Error recording event:', error);
    return json({ error: 'Failed to record event' }, 500);
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
