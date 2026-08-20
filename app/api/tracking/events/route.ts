import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';
import { getTrackingSecret, verifyTrackingKey } from '@/lib/tracking-auth';

/** Map storefront tracking event names to canonical journey catalog ids. */
const STOREFRONT_TO_CATALOG: Record<string, string> = {
  search_submitted: 'searched_product',
  active_on_site: 'browse_abandonment',
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tracking-Key',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

function isRateLimited(request: NextRequest, storeId: string): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || request.headers.get('x-real-ip') || 'unknown';
  const key = `${storeId}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

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
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > 64 * 1024) {
      return json({ error: 'Payload too large' }, 413);
    }

    if (!getTrackingSecret() && process.env.NODE_ENV === 'production') {
      return json({ error: 'Tracking is not configured' }, 500);
    }

    const body = await request.json();
    const { storeId, customerId, sessionId, eventType, resourceId, resourceTitle, metadata, trackingKey } = body;

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
      select: { id: true, shopifyDomain: true },
    });

    if (!store) {
      return json({ error: 'Invalid storeId' }, 404);
    }

    if (isRateLimited(request, storeId)) {
      return json({ error: 'Too many requests' }, 429);
    }

    const submittedKey = request.headers.get('x-tracking-key') ?? trackingKey;
    if (!verifyTrackingKey(storeId, submittedKey)) {
      return json({ error: 'Invalid tracking key' }, 401);
    }

    const origin = request.headers.get('origin') ?? request.headers.get('referer');
    if (origin && store.shopifyDomain) {
      try {
        const originHost = new URL(origin).hostname.toLowerCase();
        const shopHost = store.shopifyDomain.toLowerCase();
        if (originHost.endsWith('.myshopify.com') && originHost !== shopHost) {
          return json({ error: 'Origin does not match store' }, 403);
        }
      } catch {
        return json({ error: 'Invalid origin' }, 400);
      }
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

    // ─── Journey trigger: storefront event ────────
    // Only when we can identify the visitor (id / email / phone); anonymous
    // sessions just record the event. Best-effort, non-fatal.
    const meta = (normalizeMetadata(metadata) ?? {}) as Record<string, unknown>;
    const visitorEmail = typeof meta.email === 'string' ? meta.email : undefined;
    const visitorPhone = typeof meta.phone === 'string' ? meta.phone : undefined;
    if (customerId || visitorEmail || visitorPhone) {
      const catalogId = STOREFRONT_TO_CATALOG[eventType] ?? eventType;
      try {
        await matchAndExecuteJourneys(catalogId, {
          shop: null,
          payload: {
            customer_id: customerId || undefined,
            email: visitorEmail,
            phone: visitorPhone,
            resourceId: resourceId || undefined,
            resourceTitle: resourceTitle || undefined,
            storeId,
          },
          receivedAt: new Date().toISOString(),
        });
      } catch (journeyErr) {
        console.error('[Tracking] Journey trigger dispatch failed:', journeyErr);
      }
    }

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
      'Access-Control-Allow-Headers': 'Content-Type, X-Tracking-Key',
    },
  });
}
