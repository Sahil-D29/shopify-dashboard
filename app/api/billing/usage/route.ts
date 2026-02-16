import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getMonthlyMessageCosts } from '@/lib/billing/message-cost';

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

    const { searchParams } = new URL(request.url);
    const queryStoreId = searchParams.get('storeId');
    const storeId = queryStoreId || await getCurrentStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Accept optional period query param (YYYY-MM)
    const now = new Date();
    const period = searchParams.get('period') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get message costs breakdown for the period
    const messageCosts = await getMonthlyMessageCosts(storeId, period);

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { storeId },
    });

    // Get usage metrics from UsageMetric table
    const usageMetric = await prisma.usageMetric.findFirst({
      where: {
        storeId,
        period,
      },
    });

    return NextResponse.json({
      period,
      messageCosts,
      subscriptionUsage: {
        messagesSent: usageMetric?.messagesSent || 0,
        campaignsCreated: usageMetric?.campaignsCreated || 0,
        apiCalls: usageMetric?.apiCalls || 0,
        messagesLimit: usageMetric?.messagesLimit || 0,
        campaignsLimit: usageMetric?.campaignsLimit || 0,
      },
      plan: subscription ? {
        planId: subscription.planId,
        planName: subscription.planName,
        status: subscription.status,
      } : null,
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
