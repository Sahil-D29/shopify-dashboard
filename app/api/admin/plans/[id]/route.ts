export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();

    const {
      name, price, priceINR, billingCycle, messagesPerMonth, campaignsPerMonth,
      stores, teamMembersPerStore, analytics, support,
      whatsappAutomation, customTemplates, advancedSegmentation,
      isVisible, isActive, displayOrder,
    } = body;

    const plan = await prisma.planFeature.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price }),
        ...(priceINR !== undefined && { priceINR }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(messagesPerMonth !== undefined && { messagesPerMonth }),
        ...(campaignsPerMonth !== undefined && { campaignsPerMonth }),
        ...(stores !== undefined && { stores }),
        ...(teamMembersPerStore !== undefined && { teamMembersPerStore }),
        ...(analytics !== undefined && { analytics }),
        ...(support !== undefined && { support }),
        ...(whatsappAutomation !== undefined && { whatsappAutomation }),
        ...(customTemplates !== undefined && { customTemplates }),
        ...(advancedSegmentation !== undefined && { advancedSegmentation }),
        ...(isVisible !== undefined && { isVisible }),
        ...(isActive !== undefined && { isActive }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });

    return NextResponse.json(plan);
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin plan PUT error:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // Soft-delete: set isActive = false, isVisible = false
    const plan = await prisma.planFeature.update({
      where: { id },
      data: { isActive: false, isVisible: false },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin plan DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
