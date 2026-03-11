import { prisma } from '@/lib/prisma';

/**
 * Find subscriptions expiring within the given number of days
 */
export async function checkExpiringSubscriptions(withinDays: number = 3) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const expiring = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: {
        gte: now,
        lte: futureDate,
      },
      // Only get subscriptions where we haven't sent a reminder in the last 24 hours
      OR: [
        { lastReminderSentAt: null },
        {
          lastReminderSentAt: {
            lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
      ],
    },
    include: {
      store: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return expiring;
}

/**
 * Mark a subscription as having a reminder sent
 */
export async function markReminderSent(subscriptionId: string) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { lastReminderSentAt: new Date() },
  });
}

/**
 * Get subscription expiry info for a store (used by billing page)
 */
export async function getSubscriptionExpiryInfo(storeId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) return null;

  const now = new Date();
  const endDate = new Date(subscription.currentPeriodEnd);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    subscriptionId: subscription.id,
    planId: subscription.planId,
    planName: subscription.planName,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    daysUntilExpiry,
    isExpiringSoon: daysUntilExpiry <= 7 && daysUntilExpiry > 0,
    isExpired: daysUntilExpiry <= 0,
  };
}
