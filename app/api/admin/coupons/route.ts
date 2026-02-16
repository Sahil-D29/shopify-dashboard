export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserContext } from '@/lib/user-context';

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);

    if (!userContext || userContext.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const formattedCoupons = coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      applicablePlans: coupon.applicablePlans,
      assignedStoreId: coupon.assignedStoreId,
      isRecurring: coupon.isRecurring,
      validUntil: coupon.validUntil,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usedCount,
      description: coupon.description,
      isActive: coupon.status === 'active',
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    }));

    return NextResponse.json(formattedCoupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);

    if (!userContext || userContext.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      code,
      discountType,
      value,
      applicablePlans,
      assignedStoreId,
      isRecurring,
      validUntil,
      usageLimit,
      description,
    } = body;

    if (!code || !discountType || value === undefined || !applicablePlans) {
      return NextResponse.json(
        { error: 'Missing required fields: code, discountType, value, applicablePlans' },
        { status: 400 }
      );
    }

    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      return NextResponse.json(
        { error: 'Invalid discountType. Must be PERCENTAGE or FIXED.' },
        { status: 400 }
      );
    }

    const existingCoupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: 'Coupon code already exists' },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        value,
        applicablePlans,
        assignedStoreId: assignedStoreId || null,
        isRecurring: isRecurring || false,
        validUntil: validUntil ? new Date(validUntil) : null,
        usageLimit: usageLimit || null,
        description: description || null,
        createdBy: userContext.userId,
        status: 'active',
        usedCount: 0,
        usedBy: [],
      },
    });

    return NextResponse.json(
      {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value,
        applicablePlans: coupon.applicablePlans,
        assignedStoreId: coupon.assignedStoreId,
        isRecurring: coupon.isRecurring,
        validUntil: coupon.validUntil,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usedCount,
        description: coupon.description,
        isActive: coupon.status === 'active',
        createdAt: coupon.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating coupon:', error);
    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
