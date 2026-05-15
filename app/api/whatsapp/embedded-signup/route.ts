export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getEmbeddedSignupUrl, exchangeCodeForToken, fetchWABAInfo, saveWhatsAppConfig } from '@/lib/whatsapp/embedded-signup';

const pendingSignups = new Map<string, { accessToken: string; storeId: string; expiresAt: number }>();
const SIGNUP_TOKEN_TTL_MS = 10 * 60 * 1000;

// GET: Return Facebook OAuth URL
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

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

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

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
      return NextResponse.json({ success: true, configured: true });
    }

    if (!code) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/whatsapp/embedded-signup/callback`;

    // Exchange code for token
    const { accessToken } = await exchangeCodeForToken(code, redirectUri);

    if (wabaId && phoneNumberId) {
      await saveWhatsAppConfig(storeId, wabaId, phoneNumberId, accessToken);
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
