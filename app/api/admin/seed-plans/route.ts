export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

const PLANS = [
  {
    planId: 'starter',
    name: 'Starter',
    price: 24.00,
    priceINR: 2000.00,
    billingCycle: 'monthly',
    messagesPerMonth: 5000,
    campaignsPerMonth: 10,
    stores: 1,
    teamMembersPerStore: 3,
    analytics: 'basic',
    support: 'email',
    whatsappAutomation: true,
    customTemplates: true,
    advancedSegmentation: false,
    displayOrder: 1,
  },
  {
    planId: 'growth',
    name: 'Growth',
    price: 60.00,
    priceINR: 5000.00,
    billingCycle: 'monthly',
    messagesPerMonth: 25000,
    campaignsPerMonth: -1,
    stores: 3,
    teamMembersPerStore: 10,
    analytics: 'advanced',
    support: 'priority',
    whatsappAutomation: true,
    customTemplates: true,
    advancedSegmentation: true,
    displayOrder: 2,
  },
];

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    // Deactivate all existing plans first
    const deactivated = await prisma.planFeature.updateMany({
      where: {
        planId: { notIn: PLANS.map(p => p.planId) },
      },
      data: {
        isActive: false,
        isVisible: false,
      },
    });

    // Upsert the canonical plans
    const results = [];
    for (const plan of PLANS) {
      const result = await prisma.planFeature.upsert({
        where: { planId: plan.planId },
        create: plan,
        update: plan,
      });
      results.push({ planId: result.planId, name: result.name, price: result.price, priceINR: result.priceINR });
    }

    return NextResponse.json({ success: true, plans: results, deactivatedCount: deactivated.count });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Seed plans error:', error);
    return NextResponse.json({ error: 'Failed to seed plans' }, { status: 500 });
  }
}
