import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { code, planId } = body;

    if (!code || !planId) {
      return NextResponse.json(
        { valid: false, error: 'Missing required fields: code, planId' },
        { status: 400 }
      );
    }

    // Find coupon by code
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid coupon code',
      });
    }

    // Check status
    if (coupon.status !== 'active') {
      return NextResponse.json({
        valid: false,
        error: 'Coupon is not active',
      });
    }

    // Check date range
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return NextResponse.json({
        valid: false,
        error: 'Coupon is not yet valid',
      });
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      return NextResponse.json({
        valid: false,
        error: 'Coupon has expired',
      });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({
        valid: false,
        error: 'Coupon usage limit exceeded',
      });
    }

    // Check if planId is in applicablePlans array
    if (coupon.applicablePlans && Array.isArray(coupon.applicablePlans)) {
      if (!coupon.applicablePlans.includes(planId)) {
        return NextResponse.json({
          valid: false,
          error: 'Coupon is not applicable to this plan',
        });
      }
    }

    // Check if assignedStoreId matches
    if (coupon.assignedStoreId && coupon.assignedStoreId !== storeId) {
      return NextResponse.json({
        valid: false,
        error: 'Coupon is not available for your store',
      });
    }

    // Coupon is valid
    return NextResponse.json({
      valid: true,
      discountType: coupon.discountType,
      value: coupon.value,
      description: coupon.description,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}
