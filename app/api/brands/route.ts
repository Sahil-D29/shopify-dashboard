export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/logger';

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  return role.toUpperCase().replace(/_/g, '');
}

function canAccessStore(role: string | undefined): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  return ['ADMIN', 'SUPERADMIN', 'MANAGER', 'OWNER', 'STOREOWNER', 'VIEWER', 'TEAMMEMBER'].includes(n);
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessStore(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const storeId = request.nextUrl.searchParams.get('storeId');
    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId || undefined);

    let where: { storeId?: string } = {};
    if (storeId) {
      if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.storeId = storeId;
    } else if (storeFilter.storeId) {
      where.storeId = storeFilter.storeId;
    }

    const brands = await prisma.brand.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error('Brands GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessStore(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      storeId,
      brandName,
      brandLogo,
      brandColor,
      brandSecondaryColor,
      timezone,
      industryType,
      emailSignature,
      socialLinks,
      defaultTemplates,
      settings,
    } = body as Record<string, unknown>;

    if (!storeId || !brandName) {
      return NextResponse.json({ error: 'storeId and brandName are required' }, { status: 400 });
    }

    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || (storeId as string));
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brand = await prisma.brand.create({
      data: {
        storeId: storeId as string,
        brandName: brandName as string,
        brandLogo: (brandLogo as string) ?? undefined,
        brandColor: (brandColor as string) ?? '#000000',
        brandSecondaryColor: (brandSecondaryColor as string) ?? undefined,
        timezone: (timezone as string) ?? 'UTC',
        industryType: (industryType as string) ?? undefined,
        emailSignature: (emailSignature as string) ?? undefined,
        socialLinks: (socialLinks as object) ?? undefined,
        defaultTemplates: (defaultTemplates as object) ?? undefined,
        settings: (settings as object) ?? undefined,
        createdBy: userContext.userId,
      },
    });

    await logActivity({
      userId: userContext.userId,
      storeId: brand.storeId,
      action: 'brand.created',
      resourceId: brand.id,
      details: { brandName: brand.brandName },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error('Brands POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
