import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json(
        { error: 'Missing required fields: storeId, sessionId, eventType' },
        { status: 400 }
      );
    }

    const validEventTypes = ['product_viewed', 'product_added_to_cart', 'collection_viewed'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json({ error: 'Invalid storeId' }, { status: 404 });
    }

    await prisma.storefrontEvent.create({
      data: {
        storeId,
        customerId: customerId || null,
        sessionId,
        eventType,
        resourceId: resourceId || null,
        resourceTitle: resourceTitle || null,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Tracking] Error recording event:', error);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
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
