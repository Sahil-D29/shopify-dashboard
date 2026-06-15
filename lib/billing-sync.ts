import { prisma } from '@/lib/prisma';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { getActiveShopifySubscription, mapShopifyStatus } from '@/lib/shopify-billing';

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Match a Shopify Managed Pricing plan (by handle and/or subscription name) to
 * one of our PlanFeature rows. Tolerant of handle/name variations.
 */
async function matchPlan(planHandleOrName: string, subName: string) {
  const handleNorm = normalise(planHandleOrName);
  const subNameNorm = normalise(subName || '');
  const plans = await prisma.planFeature.findMany();
  return (
    plans.find(p => p.planId === planHandleOrName) ||
    plans.find(p => normalise(p.planId) === handleNorm) ||
    plans.find(
      p =>
        handleNorm &&
        (handleNorm.includes(normalise(p.planId)) || normalise(p.planId).includes(handleNorm)),
    ) ||
    plans.find(p => subNameNorm && normalise(p.name) === subNameNorm) ||
    null
  );
}

export interface ReconcileResult {
  changed: boolean;
  status?: 'ACTIVE' | 'CANCELLED' | 'SKIPPED';
}

/**
 * Reconcile a store's local Subscription against Shopify's *actual* active
 * subscription, which is the source of truth under Managed Pricing.
 *
 * Safe to call on every billing-page load (best-effort; a Shopify API hiccup
 * leaves the DB untouched). Fixes:
 *  - false "ACTIVE" rows (e.g. a stale "Advance/ACTIVE" with no real charge)
 *  - stale plan / next-billing-date (uses Shopify's currentPeriodEnd)
 *  - missing rows after a confirm redirect that never completed
 * so the dashboard AND super-admin reflect what the merchant actually has.
 */
export async function reconcileShopifySubscription(storeId: string): Promise<ReconcileResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, shopifyDomain: true, accessToken: true },
  });

  const isShopify =
    !!store?.shopifyDomain?.endsWith('.myshopify.com') &&
    !store.shopifyDomain.startsWith('default-') &&
    !!store.accessToken;
  if (!store || !isShopify) return { changed: false, status: 'SKIPPED' };

  let token = store.accessToken!;
  try {
    if (isEncrypted(token)) token = decrypt(token);
  } catch (err) {
    console.error('[billing-sync] token decrypt failed:', err);
    return { changed: false, status: 'SKIPPED' };
  }

  let activeSub: { id: string; name?: string; status?: string; currentPeriodEnd?: string } | null =
    null;
  try {
    activeSub = await getActiveShopifySubscription(store.shopifyDomain!, token);
  } catch (err) {
    // Network/API hiccup — never break the billing page; leave DB as-is.
    console.error('[billing-sync] failed to read Shopify subscription:', err);
    return { changed: false, status: 'SKIPPED' };
  }

  const existing = await prisma.subscription.findUnique({ where: { storeId } });

  // No active subscription on Shopify → correct any false local ACTIVE.
  if (!activeSub || mapShopifyStatus(activeSub.status || '') !== 'ACTIVE') {
    if (existing && existing.billingProvider === 'shopify' && existing.status === 'ACTIVE') {
      await prisma.subscription.update({
        where: { storeId },
        data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
      });
      return { changed: true, status: 'CANCELLED' };
    }
    return { changed: false, status: 'SKIPPED' };
  }

  // Shopify reports ACTIVE → sync plan, period end, and charge GID.
  const plan = await matchPlan(activeSub.name || '', activeSub.name || '');
  const planId = plan?.planId || existing?.planId || 'starter';
  const planName = plan?.name || activeSub.name || existing?.planName || 'Plan';
  const now = new Date();
  const periodEnd = activeSub.currentPeriodEnd
    ? new Date(activeSub.currentPeriodEnd)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { storeId },
    create: {
      storeId,
      planId,
      planName,
      status: 'ACTIVE',
      billingProvider: 'shopify',
      shopifyChargeId: activeSub.id,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planId,
      planName,
      status: 'ACTIVE',
      billingProvider: 'shopify',
      shopifyChargeId: activeSub.id,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  // Record the charge once (idempotent on the Shopify AppSubscription GID).
  if (plan) {
    const sub = await prisma.subscription.findUnique({ where: { storeId } });
    if (sub) {
      const existingPayment = await prisma.payment.findFirst({
        where: { subscriptionId: sub.id, stripePaymentId: activeSub.id },
      });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            subscriptionId: sub.id,
            amount: plan.price,
            currency: 'USD',
            status: 'SUCCEEDED',
            stripePaymentId: activeSub.id,
            paidAt: now,
          },
        });
      }
    }
  }

  return { changed: true, status: 'ACTIVE' };
}
