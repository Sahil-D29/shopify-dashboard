import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { createRazorpaySubscription, getRazorpayKeyId } from '@/lib/razorpay';
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
      // Razorpay checkout
      const razorpayResult = await createRazorpaySubscription({
        planId,
        email: userEmail,
        storeId,
      });

      const keyId = getRazorpayKeyId();

      return NextResponse.json({
        gateway: 'razorpay',
        razorpaySubscriptionId: razorpayResult.subscriptionId,
        razorpayKeyId: keyId,
        shortUrl: razorpayResult.shortUrl,
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
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
