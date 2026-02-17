import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { createRazorpayOrder, getRazorpayKeyId } from '@/lib/razorpay';
import { createCheckoutSession } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { planId, currency } = body;
    const billingCycle = body.billingCycle || 'monthly';

    if (!planId || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, currency' },
        { status: 400 }
      );
    }

    // Validate plan exists — look up by planId field (e.g. "starter"), not primary key
    const plan = await prisma.planFeature.findUnique({
      where: { planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan' },
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
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
