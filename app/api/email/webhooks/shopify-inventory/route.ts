export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyVariantBackInStock } from '@/lib/email/back-in-stock';

/**
 * Shopify webhook handler for inventory changes.
 *
 * Configure in Shopify admin → Notifications → Webhooks (or via the
 * shopify-cli when developing a public app):
 *   Topic: products/update
 *   URL:   https://<your-render>/api/email/webhooks/shopify-inventory
 *   Format: JSON
 *
 * Why `products/update` and not `inventory_levels/update`?
 *  - inventory_levels/update gives inventory_item_id, not variant_id,
 *    so it requires an extra Shopify API round-trip to resolve to
 *    a variant.
 *  - products/update payload already includes the full variants[]
 *    array with id + inventory_quantity, so we can detect restock
 *    inline.
 *
 * Verification: HMAC-SHA256 of the raw body using SHOPIFY_WEBHOOK_SECRET
 * (or SHOPIFY_API_SECRET / SHOPIFY_CLIENT_SECRET as fallbacks, matching
 * the convention used by the existing /api/webhooks/shopify route).
 */

function verifyShopifySignature(
  secret: string | undefined,
  rawBody: string,
  hmacHeader: string | null,
): boolean {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

interface ShopifyVariant {
  id: number;
  product_id?: number;
  inventory_quantity?: number;
  inventory_item_id?: number;
  title?: string;
  sku?: string;
}

interface ProductsUpdatePayload {
  id?: number;
  title?: string;
  image?: { src?: string } | null;
  images?: Array<{ src?: string }>;
  handle?: string;
  variants?: ShopifyVariant[];
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topic = (request.headers.get('x-shopify-topic') ?? '').toLowerCase();
  const shopDomain = request.headers.get('x-shopify-shop-domain');

  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    process.env.SHOPIFY_CLIENT_SECRET;
  if (!verifyShopifySignature(secret, rawBody, hmacHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // We only act on products/update; other topics ack-and-skip
  if (topic !== 'products/update') {
    return NextResponse.json({ acknowledged: true, skipped: topic }, { status: 200 });
  }
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
  }

  let payload: ProductsUpdatePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const variants = payload.variants ?? [];
  if (variants.length === 0) {
    return NextResponse.json({ acknowledged: true, variants: 0 });
  }

  // Resolve the store by shopifyDomain
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json({ acknowledged: true, skipped: 'unknown store' });
  }

  const inStockVariantIds = variants
    .filter(v => typeof v.inventory_quantity === 'number' && v.inventory_quantity! > 0)
    .map(v => String(v.id));

  if (inStockVariantIds.length === 0) {
    return NextResponse.json({ acknowledged: true, variantsInStock: 0 });
  }

  // For each in-stock variant, if we have any PENDING subscriptions, trigger notifications.
  const results: Array<{
    shopifyVariantId: string;
    sent: number;
    failed: number;
  }> = [];

  for (const variantId of inStockVariantIds) {
    try {
      const result = await notifyVariantBackInStock(store.id, variantId);
      if (result.pending > 0) {
        results.push({
          shopifyVariantId: variantId,
          sent: result.sent,
          failed: result.failed,
        });
      }
    } catch (error) {
      console.warn(
        '[BackInStock webhook] notify failed for',
        variantId,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return NextResponse.json({
    acknowledged: true,
    triggered: results.length,
    results,
  });
}
