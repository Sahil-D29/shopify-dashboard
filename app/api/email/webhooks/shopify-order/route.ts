export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processOrderForCrossSell } from '@/lib/email/cross-sell';

/**
 * Shopify order webhook → schedule cross-sell emails.
 *
 * Configure in Shopify admin → Notifications → Webhooks:
 *   Topic: orders/create
 *   URL:   https://<your-render>/api/email/webhooks/shopify-order
 *   Format: JSON
 *
 * Schedules CrossSellLog rows with status=SCHEDULED and scheduledFor =
 * now + rule.emailDelayHours. The cron at /api/cron/email-cross-sell-runner
 * picks them up and sends via Resend.
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

  if (topic !== 'orders/create') {
    return NextResponse.json({ acknowledged: true, skipped: topic }, { status: 200 });
  }
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
  }

  let order: any;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json({ acknowledged: true, skipped: 'unknown store' });
  }

  try {
    const result = await processOrderForCrossSell(store.id, order);
    return NextResponse.json({ acknowledged: true, ...result });
  } catch (error) {
    console.error('[CrossSell webhook] Error:', error);
    return NextResponse.json(
      {
        acknowledged: true, // ack so Shopify doesn't retry indefinitely
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}
