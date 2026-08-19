export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/prisma';
import {
  ALL_SIDEBAR_KEYS,
  SIDEBAR_CATALOG,
  SIDEBAR_ITEMS,
  getSidebarVisibilityRules,
  isSidebarItemKey,
  isSidebarVisibilityMode,
  saveSidebarVisibilityRules,
  type SidebarVisibilityRuleValue,
} from '@/lib/app-config';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const [rules, stores, users] = await Promise.all([
      getSidebarVisibilityRules(),
      prisma.store.findMany({
        select: { id: true, storeName: true, shopifyDomain: true, isActive: true },
        orderBy: [{ storeName: 'asc' }, { shopifyDomain: 'asc' }],
      }),
      prisma.user.findMany({
        where: { role: { not: 'SUPER_ADMIN' } },
        select: { id: true, name: true, email: true, status: true },
        orderBy: { email: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      catalog: SIDEBAR_CATALOG,
      labels: SIDEBAR_ITEMS,
      allKeys: ALL_SIDEBAR_KEYS,
      rules,
      stores,
      users,
    });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/sidebar-visibility][GET]', error);
    return NextResponse.json(
      { error: 'Failed to load sidebar visibility', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin(request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const inputRules = Array.isArray(body?.rules) ? body.rules : [];
    const [stores, users] = await Promise.all([
      prisma.store.findMany({ select: { id: true } }),
      prisma.user.findMany({ select: { id: true } }),
    ]);
    const storeIds = new Set(stores.map(store => store.id));
    const userIds = new Set(users.map(user => user.id));

    const sanitizedRules: SidebarVisibilityRuleValue[] = [];

    for (const rule of inputRules) {
      if (!rule || typeof rule.itemKey !== 'string' || !isSidebarItemKey(rule.itemKey)) {
        continue;
      }

      const mode = isSidebarVisibilityMode(rule.mode) ? rule.mode : 'EVERYONE';
      const allowedStoreIds = Array.isArray(rule.allowedStoreIds)
        ? rule.allowedStoreIds.filter((id: unknown): id is string =>
            typeof id === 'string' && storeIds.has(id),
          )
        : [];
      const allowedUserIds = Array.isArray(rule.allowedUserIds)
        ? rule.allowedUserIds.filter((id: unknown): id is string =>
            typeof id === 'string' && userIds.has(id),
          )
        : [];

      sanitizedRules.push({
        itemKey: rule.itemKey,
        mode,
        allowedStoreIds,
        allowedUserIds,
        notes: typeof rule.notes === 'string' ? rule.notes.slice(0, 1000) : '',
        updatedBy: session.userId,
      });
    }

    const saved = await saveSidebarVisibilityRules(sanitizedRules, session.userId);
    return NextResponse.json({ success: true, rules: saved });
  } catch (error: any) {
    if (error?.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[admin/sidebar-visibility][PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to save sidebar visibility', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
