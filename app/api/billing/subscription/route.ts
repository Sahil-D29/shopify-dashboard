import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { cancelRazorpaySubscription } from '@/lib/razorpay';
import { cancelStripeSubscription } from '@/lib/stripe';
import { buildManagedPricingUrl } from '@/lib/shopify-billing';
import { reconcileShopifySubscription } from '@/lib/billing-sync';

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
      // New users may not have a store yet — return empty data
      return NextResponse.json({ subscription: null, usage: null });
    }

    // Check if this is a Shopify-billed store
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shopifyDomain: true, accessToken: true },
    });

    // Compute isShopifyStore early so we can return it even when there's no subscription yet
    const isShopifyStore = !!(
      store?.shopifyDomain?.endsWith('.myshopify.com') &&
      !store?.shopifyDomain?.startsWith('default-') &&
      store?.accessToken
    );

    // Shopify is the source of truth for Managed Pricing. Reconcile the local
    // record against Shopify's actual subscription before returning so the page
    // never shows a false "ACTIVE" (and picks up Shopify's real next-billing date).
    if (isShopifyStore) {
      try {
        await reconcileShopifySubscription(storeId);
      } catch (err) {
        console.error('[billing] reconcile failed (non-fatal):', err);
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { storeId },
    });

    if (!subscription) {
      // No subscription yet — normal for new users, but still return correct isShopifyStore
      return NextResponse.json({ subscription: null, usage: null, isShopifyStore });
    }

    // Get plan features
    const plan = await prisma.planFeature.findUnique({
      where: { planId: subscription.planId },
    });

    // Orphaned subscription (plan no longer exists, e.g. a stale "advance" row):
    // present it as "no active plan" rather than showing a phantom plan.
    if (!plan) {
      return NextResponse.json({ subscription: null, usage: null, isShopifyStore });
    }

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
      isShopifyStore,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        planName: subscription.planName,
        billingProvider: subscription.billingProvider,
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

    // Determine billing provider and cancel accordingly
    if (subscription.billingProvider === 'shopify') {
      // The app is enrolled in Shopify Managed Pricing. The merchant cancels or
      // changes their plan from Shopify's hosted page — the Billing API cancel
      // mutation is not used here (Managed Pricing apps can't use the Billing API).
      // Mark the subscription to end locally and hand the merchant the Shopify
      // plan-management URL so they can complete the cancellation on Shopify.
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { shopifyDomain: true },
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });

      const manageUrl = store?.shopifyDomain
        ? buildManagedPricingUrl(store.shopifyDomain)
        : null;

      return NextResponse.json({
        message:
          'To finish cancelling, manage your plan on Shopify. Your access remains active until the end of the current billing period.',
        manageUrl,
        cancelAtPeriodEnd: true,
      });
    } else if (subscription.billingProvider === 'free') {
      // Free plan — just update status, no gateway call
    } else if (subscription.stripeSubscriptionId) {
      // Legacy: determine gateway by checking latest payment currency
      let gateway: 'razorpay' | 'stripe' = 'stripe';
      if (subscription.payments.length > 0) {
        const latestPayment = subscription.payments[0];
        if (latestPayment.currency === 'INR') {
          gateway = 'razorpay';
        }
      }

      if (gateway === 'razorpay') {
        await cancelRazorpaySubscription(subscription.stripeSubscriptionId);
      } else {
        await cancelStripeSubscription(subscription.stripeSubscriptionId);
      }
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
