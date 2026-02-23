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
    const { planId, currency, couponCode } = body;
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

    // ─── Apply coupon discount ───────────────────────────────
    step = 'apply-coupon';
    let discountAmount = 0;
    let appliedCouponId: string | null = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase() },
      });

      if (coupon && coupon.status === 'active') {
        // Check if coupon is expired
        if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
          return NextResponse.json(
            { error: 'Coupon has expired' },
            { status: 400 }
          );
        }

        // Check usage limit
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
          return NextResponse.json(
            { error: 'Coupon usage limit reached' },
            { status: 400 }
          );
        }

        // Check if coupon is applicable to this plan
        const applicablePlans = coupon.applicablePlans as string[];
        if (applicablePlans && applicablePlans.length > 0 && !applicablePlans.includes(planId)) {
          return NextResponse.json(
            { error: 'Coupon is not valid for this plan' },
            { status: 400 }
          );
        }

        // Check if locked to a specific store
        if (coupon.assignedStoreId && coupon.assignedStoreId !== storeId) {
          return NextResponse.json(
            { error: 'Coupon is not valid for your store' },
            { status: 400 }
          );
        }

        // Calculate discount
        const originalPrice = currency === 'INR'
          ? (Number(plan.priceINR) || 0)
          : Number(plan.price);

        if (coupon.discountType === 'PERCENTAGE') {
          discountAmount = (originalPrice * Number(coupon.value)) / 100;
        } else {
          // FIXED discount
          discountAmount = Number(coupon.value);
        }

        appliedCouponId = coupon.id;
      }
    }

    if (currency === 'INR') {
      // Razorpay Orders API checkout
      const originalAmountINR = Number(plan.priceINR) || 0;
      const amountINR = Math.max(0, originalAmountINR - discountAmount);

      if (amountINR <= 0) {
        // Fully discounted or free plan — activate immediately
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

        // Increment coupon usage
        if (appliedCouponId) {
          await prisma.coupon.update({
            where: { id: appliedCouponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        return NextResponse.json({
          gateway: 'free',
          message: appliedCouponId
            ? 'Coupon applied! Plan activated for free.'
            : 'Free plan activated successfully',
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

      // Increment coupon usage after successful order creation
      if (appliedCouponId) {
        await prisma.coupon.update({
          where: { id: appliedCouponId },
          data: { usedCount: { increment: 1 } },
        });
      }

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
        originalAmount: Math.round(originalAmountINR * 100),
        discountApplied: discountAmount > 0 ? Math.round(discountAmount * 100) : 0,
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
    console.error('Billing checkout error at step:', step, error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      {
        error: message,
        step,
      },
      { status: 500 }
    );
  }
}
