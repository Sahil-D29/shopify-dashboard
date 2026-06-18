export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/prisma';
import {
  ALL_SIDEBAR_KEYS,
  SIDEBAR_ITEMS,
  getStoreFeatureFlags,
  saveStoreFeatureFlags,
} from '@/lib/app-config';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { id: true, storeName: true, shopifyDomain: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const flags = await getStoreFeatureFlags(id);
    return NextResponse.json({
      success: true,
      store,
      flags,
      catalog: SIDEBAR_ITEMS,
      allKeys: ALL_SIDEBAR_KEYS,
    });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/stores/features][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load feature flags', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin(request);
    const { id } = await params;

    const store = await prisma.store.findUnique({ where: { id }, select: { id: true } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const flags = await saveStoreFeatureFlags(
      id,
      {
        disabledItems: Array.isArray(body?.disabledItems) ? body.disabledItems : undefined,
        notes: typeof body?.notes === 'string' ? body.notes : undefined,
        fullAccess: typeof body?.fullAccess === 'boolean' ? body.fullAccess : undefined,
      },
      session.userId,
    );
    return NextResponse.json({ success: true, flags });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/stores/features][PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to save feature flags', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
