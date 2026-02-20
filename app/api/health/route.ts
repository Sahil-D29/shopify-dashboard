export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const checks: Record<string, string> = {};

  // 1. Database
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'ok';
  } catch (e) {
    checks.database = `error: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  // 2. Auth secrets
  const hasAuthSecret = !!(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  checks.authSecret = hasAuthSecret ? 'ok' : 'MISSING — set AUTH_SECRET or NEXTAUTH_SECRET';

  // 3. NEXTAUTH_URL
  const authUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (!authUrl) {
    checks.nextauthUrl = 'MISSING — set NEXTAUTH_URL';
  } else if (authUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    checks.nextauthUrl = `WRONG — "${authUrl}" contains localhost (set to your Render URL)`;
  } else {
    checks.nextauthUrl = `ok (${authUrl})`;
  }

  // 4. Google OAuth
  checks.googleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? 'ok'
    : 'MISSING — Google sign-in disabled';

  // 5. Admin JWT
  checks.adminJwtSecret = !!(process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET)
    ? 'ok'
    : 'MISSING — admin panel login will fail';

  // 6. Razorpay
  checks.razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? 'ok'
    : 'MISSING — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for INR billing';

  const allOk = Object.values(checks).every((v) => v === 'ok' || v.startsWith('ok'));

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks,
  }, { status: allOk ? 200 : 503 });
}
