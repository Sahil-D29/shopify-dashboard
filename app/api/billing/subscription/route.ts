import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { cancelRazorpaySubscription } from '@/lib/razorpay';
import { cancelStripeSubscription } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

    const subscription = await prisma.subscription.findUnique({
      where: { storeId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    // Get plan features
    const plan = await prisma.planFeature.findUnique({
      where: { planId: subscription.planId },
    });

    // Get usage metrics for current period
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const usageMetric = await prisma.usageMetric.findFirst({
      where: {
        storeId,
        period,
      },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        planName: subscription.planName,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        plan: plan || null,
      },
      usage: {
        messagesSent: usageMetric?.messagesSent || 0,
        campaignsCreated: usageMetric?.campaignsCreated || 0,
        apiCalls: usageMetric?.apiCalls || 0,
        messagesLimit: usageMetric?.messagesLimit || plan?.messagesPerMonth || 0,
        campaignsLimit: usageMetric?.campaignsLimit || plan?.campaignsPerMonth || 0,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const subscription = await prisma.subscription.findUnique({
      where: { storeId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    if (!subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    // Determine gateway by checking latest payment currency
    let gateway: 'razorpay' | 'stripe' = 'stripe';
    if (subscription.payments.length > 0) {
      const latestPayment = subscription.payments[0];
      if (latestPayment.currency === 'INR') {
        gateway = 'razorpay';
      }
    }

    // Cancel subscription with appropriate gateway
    if (gateway === 'razorpay') {
      await cancelRazorpaySubscription(subscription.stripeSubscriptionId);
    } else {
      await cancelStripeSubscription(subscription.stripeSubscriptionId);
    }

    // Update subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
      },
    });

    return NextResponse.json({
      message: 'Subscription cancelled successfully',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
