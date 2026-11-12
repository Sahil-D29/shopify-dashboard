export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { appProxyTimestampIsFresh, verifyShopifyAppProxy } from '@/lib/shopify-app-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const secret = process.env.SHOPIFY_API_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET ?? '';
  if (!verifyShopifyAppProxy(request.nextUrl.searchParams, secret) || !appProxyTimestampIsFresh(request.nextUrl.searchParams)) {
    return NextResponse.json({ error: 'Invalid storefront signature' }, { status: 401 });
  }
  const segments = (await params).path ?? [];
  const token = segments.at(-1) ?? '';
  if (!token || segments.at(-2) !== 'r') return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const link = await prisma.journeyTrackedLink.findUnique({ where: { tokenHash } });
  if (!link || link.expiresAt <= new Date()) return NextResponse.json({ error: 'This recovery link has expired' }, { status: 410 });
  const shop = request.nextUrl.searchParams.get('shop');
  const store = await prisma.store.findFirst({ where: { id: link.storeId, shopifyDomain: shop ?? '' }, select: { id: true } });
  if (!store) return NextResponse.json({ error: 'Link does not belong to this store' }, { status: 403 });
  let destination: URL;
  try {
    destination = new URL(link.destination);
  } catch {
    return NextResponse.json({ error: 'Invalid recovery destination' }, { status: 410 });
  }
  if (destination.protocol !== 'https:') return NextResponse.json({ error: 'Unsafe recovery destination' }, { status: 410 });

  const now = new Date();
  await prisma.$transaction(async tx => {
    const first = await tx.journeyTrackedLink.updateMany({
      where: { id: link.id, firstClickedAt: null },
      data: { firstClickedAt: now, lastClickedAt: now, clickCount: { increment: 1 } },
    });
    if (!first.count) {
      await tx.journeyTrackedLink.update({ where: { id: link.id }, data: { lastClickedAt: now, clickCount: { increment: 1 } } });
      return;
    }
    await tx.journeyActivityDoc.create({
      data: {
        id: `click:${link.id}`,
        enrollmentId: link.enrollmentId,
        data: {
          id: `click:${link.id}`,
          enrollmentId: link.enrollmentId,
          timestamp: now.toISOString(),
          eventType: 'link_clicked',
          data: { nodeId: link.nodeId, messageId: link.messageId },
        },
      },
    });
  });
  return NextResponse.redirect(destination, 302);
}
