export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getEmbeddedSignupUrl, exchangeCodeForToken, fetchWABAInfo, saveWhatsAppConfig } from '@/lib/whatsapp/embedded-signup';
import { META_GRAPH_API_VERSION } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';

const pendingSignups = new Map<string, { accessToken: string; storeId: string; expiresAt: number }>();
const SIGNUP_TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Register a freshly-connected number for Cloud API sending (best effort).
 * Without this, sends fail with #133010 "Account not registered".
 */
async function tryRegisterNumber(phoneNumberId: string, accessToken: string): Promise<void> {
  try {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${phoneNumberId}/register`, accessToken), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
  } catch {
    // Non-fatal — user can register manually from Settings.
  }
}

/**
 * Resolve a storeId for the current user. Falls back to the user's first
 * existing store if getCurrentStoreId fails (e.g. no Shopify connected yet),
 * and auto-creates a default store if the user has none at all.
 */
async function resolveStoreId(request: NextRequest, userId: string): Promise<string> {
  // 1. Try the standard resolution (header / cookie / query)
  const fromRequest = await getCurrentStoreId(request);
  if (fromRequest) return fromRequest;

  // 2. Look up any store the user owns or is a member of
  const existing = await prisma.store.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: 'ACTIVE' } } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing.id;

  // 3. No store exists — auto-create a default one so WhatsApp can be connected
  //    independently of Shopify
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const storeName = user?.name ? `${user.name}'s Store` : 'My Store';

  const store = await prisma.store.create({
    data: {
      shopifyDomain: `whatsapp-${Date.now()}.placeholder.io`,
      shopifyStoreId: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      storeName,
      accessToken: 'none',
      scope: '',
      ownerId: userId,
      isActive: true,
    },
  });

  await prisma.storeMember.create({
    data: { userId, storeId: store.id, role: 'OWNER', status: 'ACTIVE' },
  });

  return store.id;
}

// GET: Return Facebook OAuth URL
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await resolveStoreId(request, session.user.id);

    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/whatsapp/embedded-signup/callback`;
    const loginUrl = getEmbeddedSignupUrl(storeId, redirectUri);

    return NextResponse.json({ loginUrl, redirectUri });
  } catch (error) {
    console.error('Embedded signup URL error:', error);
    return NextResponse.json({ error: 'Failed to generate signup URL' }, { status: 500 });
  }
}

// POST: Complete signup (exchange code, fetch WABA, save config)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await resolveStoreId(request, session.user.id);

    const body = await request.json();
    const { code, wabaId, phoneNumberId, signupToken } = body;

    // Handle second step: user selected a WABA from a previous multi-option response
    if (signupToken && wabaId && phoneNumberId) {
      const pending = pendingSignups.get(signupToken);
      if (!pending || pending.storeId !== storeId || Date.now() > pending.expiresAt) {
        pendingSignups.delete(signupToken);
        return NextResponse.json({ error: 'Signup session expired. Please start over.' }, { status: 400 });
      }
      pendingSignups.delete(signupToken);
      await saveWhatsAppConfig(storeId, wabaId, phoneNumberId, pending.accessToken);
      await tryRegisterNumber(phoneNumberId, pending.accessToken);
      return NextResponse.json({ success: true, configured: true });
    }

    if (!code) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
    }

    // Popup flow (FB JS SDK with config_id) sends wabaId+phoneNumberId alongside
    // the code — no redirect_uri needed. The old redirect flow only sends `code`
    // and requires the redirect_uri to match exactly.
    const isPopupFlow = !!(wabaId && phoneNumberId);
    const redirectUri = isPopupFlow
      ? undefined
      : `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/api/whatsapp/embedded-signup/callback`;
    const { accessToken } = await exchangeCodeForToken(code, redirectUri);

    // Happy path: the popup's session-info listener already returned the
    // business' WABA id + phone number id, so save immediately.
    if (wabaId && phoneNumberId) {
      await saveWhatsAppConfig(storeId, wabaId, phoneNumberId, accessToken);
      await tryRegisterNumber(phoneNumberId, accessToken);
      return NextResponse.json({ success: true, configured: true });
    }

    // Fetch available WABAs
    const { businesses } = await fetchWABAInfo(accessToken);

    if (businesses.length === 0) {
      return NextResponse.json({ error: 'No WhatsApp Business Accounts found' }, { status: 404 });
    }

    // If only one WABA with one phone, auto-configure
    if (businesses.length === 1 && businesses[0].phoneNumbers.length === 1) {
      const biz = businesses[0];
      await saveWhatsAppConfig(
        storeId,
        biz.wabaId || biz.id,
        biz.phoneNumbers[0].id,
        accessToken,
        biz.name
      );
      await tryRegisterNumber(biz.phoneNumbers[0].id, accessToken);
      return NextResponse.json({ success: true, configured: true, businessName: biz.name, phoneNumber: biz.phoneNumbers[0].displayPhoneNumber });
    }

    // Multiple options — store token server-side, return a reference key
    const token = crypto.randomUUID();
    pendingSignups.set(token, { accessToken, storeId, expiresAt: Date.now() + SIGNUP_TOKEN_TTL_MS });

    // Cleanup expired entries
    for (const [key, val] of pendingSignups) {
      if (Date.now() > val.expiresAt) pendingSignups.delete(key);
    }

    return NextResponse.json({
      success: true,
      configured: false,
      businesses,
      signupToken: token,
    });
  } catch (error) {
    console.error('Embedded signup error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Signup failed' }, { status: 500 });
  }
}
