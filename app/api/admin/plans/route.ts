export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const plans = await prisma.planFeature.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ plans });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin plans GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();

    const {
      planId, name, price, priceINR, billingCycle = 'monthly',
      messagesPerMonth = 1000, campaignsPerMonth = 5,
      stores = 1, teamMembersPerStore = 3,
      analytics = 'basic', support = 'email',
      whatsappAutomation = false, customTemplates = false, advancedSegmentation = false,
      isVisible = true, isActive = true, displayOrder = 0,
    } = body;

    if (!planId || !name || price === undefined) {
      return NextResponse.json({ error: 'planId, name, and price are required' }, { status: 400 });
    }

    // Check if planId already exists
    const existing = await prisma.planFeature.findUnique({ where: { planId } });
    if (existing) {
      return NextResponse.json({ error: 'A plan with this planId already exists' }, { status: 400 });
    }

    const plan = await prisma.planFeature.create({
      data: {
        planId,
        name,
        price,
        priceINR: priceINR ?? null,
        billingCycle,
        messagesPerMonth,
        campaignsPerMonth,
        stores,
        teamMembersPerStore,
        analytics,
        support,
        whatsappAutomation,
        customTemplates,
        advancedSegmentation,
        isVisible,
        isActive,
        displayOrder,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin plans POST error:', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
