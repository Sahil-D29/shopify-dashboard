import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { isRazorpayConfigured, getRazorpayKeyId } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/billing/debug
 * Diagnostic endpoint to test each step of the checkout flow.
 * Returns status of: auth, store, plans, razorpay config.
 */
export async function GET(request: NextRequest) {
  const checks: Record<string, unknown> = {};

  // 1. Auth check
  try {
    const session = await auth();
    checks.auth = {
      ok: !!session?.user?.email,
      email: session?.user?.email || null,
      userId: session?.user?.id || null,
    };
  } catch (e) {
    checks.auth = { ok: false, error: e instanceof Error ? e.message : 'Unknown auth error' };
  }

  // 2. Store check
  try {
    const storeId = await getCurrentStoreId(request);
    if (storeId) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, storeName: true, isActive: true },
      });
      checks.store = { ok: !!store, storeId, store };
    } else {
      checks.store = { ok: false, error: 'No storeId resolved from header/cookie/query' };
    }
  } catch (e) {
    checks.store = { ok: false, error: e instanceof Error ? e.message : 'Unknown store error' };
  }

  // 3. Plans check
  try {
    const plans = await prisma.planFeature.findMany({
      select: { planId: true, name: true, price: true, priceINR: true },
    });
    checks.plans = {
      ok: plans.length > 0,
      count: plans.length,
      plans: plans.map(p => ({ planId: p.planId, name: p.name, priceUSD: Number(p.price), priceINR: Number(p.priceINR) })),
    };
  } catch (e) {
    checks.plans = { ok: false, error: e instanceof Error ? e.message : 'Unknown DB error' };
  }

  // 4. Razorpay config check
  checks.razorpay = {
    ok: isRazorpayConfigured(),
    keyId: getRazorpayKeyId() ? `${getRazorpayKeyId()!.slice(0, 8)}...` : null,
    hasSecret: !!process.env.RAZORPAY_KEY_SECRET,
  };

  // 5. Stripe config check
  checks.stripe = {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  };

  // 6. Database connectivity (use a simple count query to avoid $queryRaw issues with Neon adapter)
  try {
    const count = await prisma.user.count();
    checks.database = { ok: true, userCount: count };
  } catch (e) {
    checks.database = { ok: false, error: e instanceof Error ? e.message : 'DB connection failed' };
  }

  const allOk = Object.values(checks).every((c: any) => c.ok !== false);

  return NextResponse.json({
    status: allOk ? 'all_checks_passed' : 'some_checks_failed',
    checks,
  });
}
