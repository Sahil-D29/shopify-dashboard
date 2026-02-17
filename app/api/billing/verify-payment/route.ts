import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { verifyRazorpayPaymentSignature } from '@/lib/razorpay';

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return NextResponse.json(
        { error: 'Missing payment verification fields' },
        { status: 400 }
      );
    }

    // Verify the payment signature
    const isValid = verifyRazorpayPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment verification failed — invalid signature' },
        { status: 400 }
      );
    }

    // Signature valid — activate subscription
    const plan = await prisma.planFeature.findUnique({ where: { planId } });
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

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
        stripeSubscriptionId: razorpay_order_id,
        stripeCustomerId: null,
      },
      update: {
        planId: plan.planId,
        planName: plan.name,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: razorpay_order_id,
      },
    });

    // Record the payment
    const sub = await prisma.subscription.findUnique({ where: { storeId } });
    if (sub) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: Number(plan.priceINR) || 0,
          currency: 'INR',
          status: 'SUCCEEDED',
          stripePaymentId: razorpay_payment_id,
          paidAt: now,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated',
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
