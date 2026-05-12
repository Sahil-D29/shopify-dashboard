export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function verifyHmac(secret: string | undefined, rawBody: string, hmacHeader: string | null): boolean {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/shopify/compliance
 *
 * Handles Shopify's 3 mandatory compliance webhooks:
 *   - customers/data_request  → return what data we store about a customer
 *   - customers/redact        → delete customer data
 *   - shop/redact             → delete all data for an uninstalled shop
 *
 * Set these URLs in Partner Dashboard → App → Configuration → Compliance webhooks:
 *   Customer data request:  https://app.dorza.io/api/webhooks/shopify/compliance
 *   Customer erasure:       https://app.dorza.io/api/webhooks/shopify/compliance
 *   Shop erasure:           https://app.dorza.io/api/webhooks/shopify/compliance
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topicHeader = request.headers.get('x-shopify-topic');

  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.SHOPIFY_CLIENT_SECRET ||
    process.env.SHOPIFY_API_SECRET;

  if (!verifyHmac(secret, rawBody, hmacHeader)) {
    console.error('[Compliance Webhook] HMAC verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const topic = (topicHeader ?? '').toLowerCase();
  const shopDomain = (payload.shop_domain as string) || '';

  console.log(`[Compliance Webhook] topic=${topic} shop=${shopDomain}`);

  switch (topic) {
    case 'customers/data_request':
      return handleCustomerDataRequest(payload, shopDomain);
    case 'customers/redact':
      return handleCustomerRedact(payload, shopDomain);
    case 'shop/redact':
      return handleShopRedact(shopDomain);
    default:
      return NextResponse.json({ error: `Unknown topic: ${topic}` }, { status: 400 });
  }
}

/**
 * customers/data_request — Shopify asks what data we store about a customer.
 * We respond with 200 to acknowledge; the actual data is sent to the merchant
 * via the data_request payload's `data_request.id`.
 */
async function handleCustomerDataRequest(
  payload: Record<string, unknown>,
  shopDomain: string,
) {
  const customer = payload.customer as Record<string, unknown> | undefined;
  const shopifyCustomerId = customer?.id ? String(customer.id) : null;
  const email = (customer?.email as string) || '';
  const phone = (customer?.phone as string) || '';

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json({ acknowledged: true, data: [] });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      storeId: store.id,
      OR: [
        ...(shopifyCustomerId ? [{ shopifyCustomerId }] : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      tags: true,
      customFields: true,
      createdAt: true,
    },
  });

  console.log(
    `[Compliance] customers/data_request: shop=${shopDomain} found=${contacts.length} contacts`,
  );

  return NextResponse.json({ acknowledged: true, data_stored: contacts });
}

/**
 * customers/redact — Delete all personal data for a specific customer.
 */
async function handleCustomerRedact(
  payload: Record<string, unknown>,
  shopDomain: string,
) {
  const customer = payload.customer as Record<string, unknown> | undefined;
  const shopifyCustomerId = customer?.id ? String(customer.id) : null;
  const email = (customer?.email as string) || '';
  const phone = (customer?.phone as string) || '';

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json({ acknowledged: true });
  }

  const conditions = [
    ...(shopifyCustomerId ? [{ shopifyCustomerId }] : []),
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (conditions.length === 0) {
    return NextResponse.json({ acknowledged: true });
  }

  const contacts = await prisma.contact.findMany({
    where: { storeId: store.id, OR: conditions },
    select: { id: true },
  });

  const contactIds = contacts.map((c) => c.id);

  if (contactIds.length > 0) {
    await prisma.message.deleteMany({ where: { contactId: { in: contactIds } } });
    await prisma.conversation.deleteMany({ where: { contactId: { in: contactIds } } });
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
  }

  console.log(
    `[Compliance] customers/redact: shop=${shopDomain} deleted=${contactIds.length} contacts`,
  );

  return NextResponse.json({ acknowledged: true });
}

/**
 * shop/redact — Delete ALL data for a shop after it uninstalls the app.
 * Shopify sends this 48 hours after uninstall.
 */
async function handleShopRedact(shopDomain: string) {
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true },
  });

  if (!store) {
    console.log(`[Compliance] shop/redact: shop=${shopDomain} not found, nothing to delete`);
    return NextResponse.json({ acknowledged: true });
  }

  // Cascade delete: contacts → conversations → messages are handled by Prisma onDelete: Cascade
  // But we also clean up other store-scoped data
  await prisma.$transaction([
    prisma.campaignLog.deleteMany({ where: { campaign: { storeId: store.id } } }),
    prisma.campaignQueueItem.deleteMany({ where: { storeId: store.id } }),
    prisma.campaign.deleteMany({ where: { storeId: store.id } }),
    prisma.message.deleteMany({ where: { contact: { storeId: store.id } } }),
    prisma.conversation.deleteMany({ where: { storeId: store.id } }),
    prisma.contact.deleteMany({ where: { storeId: store.id } }),
    prisma.segment.deleteMany({ where: { storeId: store.id } }),
    prisma.journey.deleteMany({ where: { storeId: store.id } }),
    prisma.apiKey.deleteMany({ where: { storeId: store.id } }),
    prisma.storeMember.deleteMany({ where: { storeId: store.id } }),
    prisma.store.delete({ where: { id: store.id } }),
  ]);

  console.log(`[Compliance] shop/redact: shop=${shopDomain} all data deleted`);

  return NextResponse.json({ acknowledged: true });
}
