export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const brands = await prisma.brand.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ brands });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin brand GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    const body = await request.json();

    const {
      id, storeId, brandName, brandLogo, brandColor, brandSecondaryColor,
      timezone, industryType, emailSignature, socialLinks, settings,
    } = body;

    if (id) {
      // Update existing brand
      const brand = await prisma.brand.update({
        where: { id },
        data: {
          ...(brandName !== undefined && { brandName }),
          ...(brandLogo !== undefined && { brandLogo }),
          ...(brandColor !== undefined && { brandColor }),
          ...(brandSecondaryColor !== undefined && { brandSecondaryColor }),
          ...(timezone !== undefined && { timezone }),
          ...(industryType !== undefined && { industryType }),
          ...(emailSignature !== undefined && { emailSignature }),
          ...(socialLinks !== undefined && { socialLinks }),
          ...(settings !== undefined && { settings }),
        },
      });
      return NextResponse.json(brand);
    }

    // Create new brand
    if (!storeId || !brandName) {
      return NextResponse.json({ error: 'storeId and brandName are required' }, { status: 400 });
    }

    const brand = await prisma.brand.create({
      data: {
        storeId,
        brandName,
        brandLogo: brandLogo || null,
        brandColor: brandColor || '#000000',
        brandSecondaryColor: brandSecondaryColor || null,
        timezone: timezone || 'UTC',
        industryType: industryType || null,
        emailSignature: emailSignature || null,
        socialLinks: socialLinks || {},
        settings: settings || {},
        createdBy: session.userId,
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin brand POST error:', error);
    return NextResponse.json({ error: 'Failed to save brand' }, { status: 500 });
  }
}
