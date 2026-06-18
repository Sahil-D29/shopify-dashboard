import { prisma } from '@/lib/prisma';

/**
 * A store is considered "subscribed" only when it has a Subscription that is
 * active-ish AND whose plan still exists. This deliberately treats orphaned rows
 * (e.g. a stale planId="advance" that is not a real PlanFeature) as NOT
 * subscribed, so they neither unlock the app nor show as a real plan.
 */
export async function hasValidActiveSubscription(storeId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { storeId },
    select: { status: true, planId: true },
  });
  if (!sub) return false;
  if (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING') return false;

  const plan = await prisma.planFeature.findUnique({
    where: { planId: sub.planId },
    select: { id: true },
  });
  return !!plan;
}
