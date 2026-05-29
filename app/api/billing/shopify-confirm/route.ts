export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';
import {
  getShopifySubscriptionStatus,
  getActiveShopifySubscription,
  mapShopifyStatus,
} from '@/lib/shopify-billing';
import { decrypt, isEncrypted } from '@/lib/encryption';

/**
 * GET /api/billing/shopify-confirm
 *
 * Shopify redirects here after the merchant picks a plan and approves a charge.
 *
 * Managed Pricing (current mode):
 *   ?plan_handle=<handle>&shop=<domain>
 *   The app is enrolled in Shopify App Pricing — the merchant selected a plan
 *   on Shopify's hosted page. We confirm the active subscription via the Admin
 *   API and sync it to our DB.
 *
 * Legacy Billing API (fallback, no longer used to create charges):
 *   ?charge_id=gid://shopify/AppSubscription/12345
 *   Verified directly by GID.
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
    const planHandle = searchParams.get('plan_handle');
    const shopDomain = searchParams.get('shop');

    if (!chargeId && !planHandle) {
      console.error('[Shopify Billing] Missing plan_handle/charge_id in confirmation callback');
      return NextResponse.redirect(`${baseUrl}/billing?error=missing_plan`);
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

    // Decrypt the access token from DB
    let decryptedToken = store.accessToken;
    try {
      if (isEncrypted(decryptedToken)) {
        decryptedToken = decrypt(decryptedToken);
      }
    } catch (err) {
      console.error('[Shopify Billing] Failed to decrypt access token:', err);
      return NextResponse.redirect(`${baseUrl}/billing?error=token_decrypt_failed`);
    }

    // ─── Managed Pricing path (plan_handle present) ──────────────
    if (planHandle) {
      console.log('[Shopify Billing] Managed pricing return:', { planHandle, shop });

      // Confirm the active subscription on Shopify (also gives us the GID + period end)
      let activeSub: {
        id: string;
        name?: string;
        status?: string;
        currentPeriodEnd?: string;
      } | null = null;
      try {
        activeSub = await getActiveShopifySubscription(shop, decryptedToken);
      } catch (err) {
        console.error('[Shopify Billing] Failed to read active subscription:', err);
        return NextResponse.redirect(`${baseUrl}/billing?error=verification_failed`);
      }

      if (!activeSub || mapShopifyStatus(activeSub.status || '') !== 'ACTIVE') {
        console.log('[Shopify Billing] No active managed-pricing subscription found');
        return NextResponse.redirect(`${baseUrl}/billing?error=charge_declined`);
      }

      // Plan handle maps directly to our planId (handles are 'starter' / 'growth')
      const planId = planHandle;
      const plan = await prisma.planFeature.findUnique({ where: { planId } });
      if (!plan) {
        console.error('[Shopify Billing] Unknown plan_handle:', planHandle);
        return NextResponse.redirect(`${baseUrl}/billing?error=unknown_plan`);
      }

      const now = new Date();
      const periodEnd = activeSub.currentPeriodEnd
        ? new Date(activeSub.currentPeriodEnd)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.subscription.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          planId: plan.planId,
          planName: plan.name,
          status: 'ACTIVE',
          billingProvider: 'shopify',
          shopifyChargeId: activeSub.id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId: plan.planId,
          planName: plan.name,
          status: 'ACTIVE',
          billingProvider: 'shopify',
          shopifyChargeId: activeSub.id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      const subscription = await prisma.subscription.findUnique({
        where: { storeId: store.id },
      });
      if (subscription) {
        await prisma.payment.create({
          data: {
            subscriptionId: subscription.id,
            amount: plan.price,
            currency: 'USD',
            status: 'SUCCEEDED',
            stripePaymentId: activeSub.id, // Shopify AppSubscription GID as reference
            paidAt: now,
          },
        });
      }

      console.log('[Shopify Billing] Managed pricing subscription synced:', {
        storeId: store.id,
        planId: plan.planId,
        gid: activeSub.id,
      });

      return NextResponse.redirect(`${baseUrl}/billing?success=shopify_activated`);
    }

    // ─── Legacy Billing API path (charge_id present) ─────────────
    console.log('[Shopify Billing] Verifying legacy charge:', { chargeId, shop });

    let subscriptionStatus;
    try {
      subscriptionStatus = await getShopifySubscriptionStatus(
        shop,
        decryptedToken,
        chargeId!,
      );
    } catch (err) {
      console.error('[Shopify Billing] Failed to verify charge:', err);
      return NextResponse.redirect(`${baseUrl}/billing?error=verification_failed`);
    }

    if (subscriptionStatus.status === 'ACTIVE') {
      const now = new Date();
      const periodEnd = subscriptionStatus.currentPeriodEnd
        ? new Date(subscriptionStatus.currentPeriodEnd)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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

      const plan = await prisma.planFeature.findUnique({ where: { planId } });
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
            stripePaymentId: chargeId!,
            paidAt: now,
          },
        });
      }

      const response = NextResponse.redirect(`${baseUrl}/billing?success=shopify_activated`);
      response.cookies.delete('shopify_billing_plan');
      return response;
    }

    console.log('[Shopify Billing] Charge not active:', subscriptionStatus.status);
    return NextResponse.redirect(
      `${baseUrl}/billing?error=charge_${subscriptionStatus.status.toLowerCase()}`,
    );
  } catch (error) {
    console.error('[Shopify Billing] Confirmation callback error:', error);
    return NextResponse.redirect(`${baseUrl}/billing?error=callback_failed`);
  }
}
