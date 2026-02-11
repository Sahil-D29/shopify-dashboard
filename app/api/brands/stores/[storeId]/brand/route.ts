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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const userContext = await getUserContext(_request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessStore(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storeId } = await context.params;
    const currentStoreId = await getCurrentStoreId(_request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brand = await prisma.brand.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    if (!brand) {
      return NextResponse.json(null);
    }
    return NextResponse.json(brand);
  } catch (error) {
    console.error('Brand GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessStore(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storeId } = await context.params;
    const currentStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const existing = await prisma.brand.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    const data: Record<string, unknown> = {
      storeId,
      brandName: body.brandName ?? existing?.brandName ?? 'Brand',
      brandLogo: body.brandLogo ?? existing?.brandLogo ?? undefined,
      brandColor: body.brandColor ?? existing?.brandColor ?? '#000000',
      brandSecondaryColor: body.brandSecondaryColor ?? existing?.brandSecondaryColor ?? undefined,
      timezone: body.timezone ?? existing?.timezone ?? 'UTC',
      industryType: body.industryType ?? existing?.industryType ?? undefined,
      emailSignature: body.emailSignature ?? existing?.emailSignature ?? undefined,
      socialLinks: body.socialLinks ?? existing?.socialLinks ?? undefined,
      defaultTemplates: body.defaultTemplates ?? existing?.defaultTemplates ?? undefined,
      settings: body.settings ?? existing?.settings ?? undefined,
      createdBy: (existing?.createdBy ?? userContext.userId) as string,
    };

    let brand;
    if (existing) {
      brand = await prisma.brand.update({
        where: { id: existing.id },
        data: data as Parameters<typeof prisma.brand.update>[0]['data'],
      });
    } else {
      brand = await prisma.brand.create({
        data: { ...data, createdBy: userContext.userId } as Parameters<typeof prisma.brand.create>[0]['data'],
      });
    }

    await logActivity({
      userId: userContext.userId,
      storeId,
      action: 'brand.updated',
      resourceId: brand.id,
      details: { brandName: brand.brandName },
    });

    return NextResponse.json(brand);
  } catch (error) {
    console.error('Brand PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
