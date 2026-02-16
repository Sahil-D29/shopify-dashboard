import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const plans = await prisma.planFeature.findMany({
      orderBy: {
        price: 'asc',
      },
    });

    return NextResponse.json({
      plans: plans.map(plan => ({
        id: plan.id,
        planId: plan.planId,
        name: plan.name,
        priceUSD: plan.price,
        priceINR: plan.priceINR,
        billingCycle: plan.billingCycle,
        messagesPerMonth: plan.messagesPerMonth,
        campaignsPerMonth: plan.campaignsPerMonth,
        stores: plan.stores,
        teamMembersPerStore: plan.teamMembersPerStore,
        analytics: plan.analytics,
        support: plan.support,
        whatsappAutomation: plan.whatsappAutomation,
        customTemplates: plan.customTemplates,
        advancedSegmentation: plan.advancedSegmentation,
      })),
      authenticated: !!session,
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}
