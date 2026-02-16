export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserContext } from '@/lib/user-context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext || userContext.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    return NextResponse.json(coupon);
  } catch (error) {
    console.error('Admin coupon GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext || userContext.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { code, discountType, value, applicablePlans, assignedStoreId, isRecurring, validUntil, usageLimit, description, status } = body;

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(discountType && { discountType }),
        ...(value !== undefined && { value }),
        ...(applicablePlans && { applicablePlans }),
        ...(assignedStoreId !== undefined && { assignedStoreId }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
        ...(usageLimit !== undefined && { usageLimit }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
    });

    return NextResponse.json(coupon);
  } catch (error) {
    console.error('Admin coupon PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext || userContext.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.coupon.update({
      where: { id },
      data: { status: 'inactive' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin coupon DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
