export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';
import { getShopifySubscriptionStatus } from '@/lib/shopify-billing';

/**
 * GET /api/billing/shopify-confirm
 *
 * Shopify redirects here after the merchant approves or declines a charge.
 * Query params: ?charge_id=gid://shopify/AppSubscription/12345
 *
 * 1. Verify the charge status via GraphQL
 * 2. If ACTIVE → create/update Subscription record
 * 3. Redirect to /billing with success or error
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=unauthorized`);
    }

    const { searchParams } = request.nextUrl;
    const chargeId = searchParams.get('charge_id');
    const shopDomain = searchParams.get('shop');

    if (!chargeId) {
      console.error('[Shopify Billing] Missing charge_id in confirmation callback');
      return NextResponse.redirect(`${baseUrl}/billing?error=missing_charge_id`);
    }

    // Resolve store
    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.redirect(`${baseUrl}/billing?error=no_store`);
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, shopifyDomain: true, accessToken: true },
    });

    if (!store || !store.accessToken) {
      return NextResponse.redirect(`${baseUrl}/billing?error=store_not_found`);
    }

    const shop = shopDomain || store.shopifyDomain || '';

    // Check the subscription status on Shopify
    console.log('[Shopify Billing] Verifying charge:', { chargeId, shop });

    let subscriptionStatus;
    try {
      subscriptionStatus = await getShopifySubscriptionStatus(
        shop,
        store.accessToken,
        chargeId,
      );
    } catch (err) {
      console.error('[Shopify Billing] Failed to verify charge:', err);
      return NextResponse.redirect(`${baseUrl}/billing?error=verification_failed`);
    }

    console.log('[Shopify Billing] Charge status:', subscriptionStatus.status);

    if (subscriptionStatus.status === 'ACTIVE') {
      // Charge approved — create/update subscription
      const now = new Date();
      const periodEnd = subscriptionStatus.currentPeriodEnd
        ? new Date(subscriptionStatus.currentPeriodEnd)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days fallback

      // Extract plan info from the pending_charge cookie or charge name
      const planInfo = request.cookies.get('shopify_billing_plan')?.value;
      let planId = 'starter';
      let planName = subscriptionStatus.name || 'Starter';

      if (planInfo) {
        try {
          const parsed = JSON.parse(planInfo);
          planId = parsed.planId || planId;
          planName = parsed.planName || planName;
        } catch {
          // ignore parse error
        }
      }

      // Look up actual plan features
      const plan = await prisma.planFeature.findUnique({
        where: { planId },
      });
      if (plan) {
        planName = plan.name;
      }

      await prisma.subscription.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          planId,
          planName,
          status: 'ACTIVE',
          billingProvider: 'shopify',
          shopifyChargeId: chargeId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId,
          planName,
          status: 'ACTIVE',
          billingProvider: 'shopify',
          shopifyChargeId: chargeId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      // Record a payment
      const subscription = await prisma.subscription.findUnique({
        where: { storeId: store.id },
      });

      if (subscription && plan) {
        await prisma.payment.create({
          data: {
            subscriptionId: subscription.id,
            amount: plan.price,
            currency: 'USD',
            status: 'SUCCEEDED',
            stripePaymentId: chargeId, // Store Shopify charge GID as reference
            paidAt: now,
          },
        });
      }

      console.log('[Shopify Billing] Subscription activated:', { storeId: store.id, planId, chargeId });

      const response = NextResponse.redirect(`${baseUrl}/billing?success=shopify_activated`);
      // Clean up the billing plan cookie
      response.cookies.delete('shopify_billing_plan');
      return response;
    }

    // Charge was declined or pending
    console.log('[Shopify Billing] Charge not active:', subscriptionStatus.status);
    return NextResponse.redirect(
      `${baseUrl}/billing?error=charge_${subscriptionStatus.status.toLowerCase()}`,
    );
  } catch (error) {
    console.error('[Shopify Billing] Confirmation callback error:', error);
    return NextResponse.redirect(`${baseUrl}/billing?error=callback_failed`);
  }
}
