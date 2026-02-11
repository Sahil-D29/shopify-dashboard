export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

export const runtime = 'nodejs';

/** Current period in YYYY-MM format */
function currentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toPercent(used: number, limit: number): number {
  if (limit <= 0 || limit === -1) return 0;
  const p = Math.round((used / limit) * 100);
  return Math.min(100, Math.max(0, p));
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = request.nextUrl.searchParams.get('storeId');
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeFilter = buildStoreFilter(userContext, storeId ?? undefined);
    const effectiveStoreId = storeFilter.storeId ?? storeId;
    if (!effectiveStoreId) {
      return NextResponse.json({ error: 'Store ID required or no store access' }, { status: 400 });
    }

    const period = currentPeriod();

    const [subscription, planFeature, usageAgg] = await Promise.all([
      prisma.subscription.findUnique({
        where: { storeId: effectiveStoreId },
      }),
      prisma.planFeature.findFirst({ orderBy: { price: 'asc' } }),
      prisma.usageMetric.aggregate({
        where: { storeId: effectiveStoreId, period },
        _sum: {
          messagesSent: true,
          campaignsCreated: true,
          apiCalls: true,
        },
      }),
    ]);

    const planId = subscription?.planId ?? (planFeature?.planId ?? 'basic');
    const plan = await prisma.planFeature.findUnique({
      where: { planId },
    });

    const messagesLimit = plan?.messagesPerMonth ?? -1;
    const campaignsLimit = plan?.campaignsPerMonth ?? -1;
    const apiCallsLimit = plan ? -1 : -1;

    const messagesSent = usageAgg._sum.messagesSent ?? 0;
    const campaignsCreated = usageAgg._sum.campaignsCreated ?? 0;
    const apiCalls = usageAgg._sum.apiCalls ?? 0;

    const percentages = {
      messages: toPercent(messagesSent, messagesLimit),
      campaigns: toPercent(campaignsCreated, campaignsLimit),
      apiCalls: toPercent(apiCalls, apiCallsLimit),
    };

    const limitExceeded = {
      exceeded:
        (messagesLimit !== -1 && messagesSent >= messagesLimit) ||
        (campaignsLimit !== -1 && campaignsCreated >= campaignsLimit) ||
        (apiCallsLimit !== -1 && apiCalls >= apiCallsLimit),
      type:
        messagesLimit !== -1 && messagesSent >= messagesLimit
          ? 'messages'
          : campaignsLimit !== -1 && campaignsCreated >= campaignsLimit
            ? 'campaigns'
            : apiCallsLimit !== -1 && apiCalls >= apiCallsLimit
              ? 'apiCalls'
              : undefined,
    };

    const response = {
      metrics: {
        usage: {
          messagesSent,
          campaignsCreated,
          apiCalls,
        },
        limits: {
          messagesPerMonth: messagesLimit,
          campaignsPerMonth: campaignsLimit,
          apiCallsPerMonth: apiCallsLimit,
        },
      },
      percentages,
      limitExceeded,
      planFeatures: plan ?? planFeature,
      subscription: {
        planType: planId,
        status: subscription?.status ?? 'ACTIVE',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Subscriptions usage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
