import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from '@/lib/razorpay';
import { createCheckoutSession } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let step = 'init';
  try {
    step = 'auth';
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    step = 'parse-body';
    const body = await request.json();
    const { planId, currency } = body;
    const billingCycle = body.billingCycle || 'monthly';

    step = 'resolve-store';
    // Resolve storeId: try tenant middleware (header/cookie/query), then fall back to request body
    let storeId = await getCurrentStoreId(request);
    if (!storeId && body.storeId) {
      storeId = body.storeId;
    }
    if (!storeId) {
      return NextResponse.json(
        { error: 'Store not found. Please set up your store in Settings first.' },
        { status: 404 }
      );
    }

    if (!planId || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, currency' },
        { status: 400 }
      );
    }

    step = 'find-plan';
    // Validate plan exists — look up by planId field (e.g. "starter"), not primary key
    const plan = await prisma.planFeature.findUnique({
      where: { planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: `Plan "${planId}" not found. Run seed-plans script to create plans.` },
        { status: 404 }
      );
    }

    const userEmail = session.user.email;

    if (currency === 'INR') {
      // Razorpay Orders API checkout
      const amountINR = Number(plan.priceINR) || 0;
      if (amountINR <= 0) {
        // Free plan — activate immediately
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await prisma.subscription.upsert({
          where: { storeId },
          create: {
            storeId,
            planId: plan.planId,
            planName: plan.name,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
          },
          update: {
            planId: plan.planId,
            planName: plan.name,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        return NextResponse.json({
          gateway: 'free',
          message: 'Free plan activated successfully',
        });
      }

      if (!isRazorpayConfigured()) {
        return NextResponse.json(
          { error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.' },
          { status: 503 }
        );
      }

      step = 'create-razorpay-order';
      const razorpayResult = await createRazorpayOrder({
        planId: plan.planId,
        planName: plan.name,
        amountINR,
        email: userEmail,
        storeId,
      });

      const keyId = getRazorpayKeyId();

      return NextResponse.json({
        gateway: 'razorpay',
        razorpayOrderId: razorpayResult.orderId,
        razorpayKeyId: keyId,
        amount: razorpayResult.amount,
        currency: razorpayResult.currency,
        planName: plan.name,
        planId: plan.planId,
        storeId,
      });
    } else if (currency === 'USD') {
      // Stripe checkout
      const stripeResult = await createCheckoutSession({
        userId: storeId,
        email: userEmail,
        planType: planId,
        billingCycle,
      });

      return NextResponse.json({
        gateway: 'stripe',
        sessionUrl: stripeResult.url,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid currency. Supported: INR, USD' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Billing checkout error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: message,
        detail: process.env.NODE_ENV !== 'production' ? stack : undefined,
        step,
      },
      { status: 500 }
    );
  }
}
