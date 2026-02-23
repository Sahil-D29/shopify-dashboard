export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    // Fetch WhatsApp configs for all stores (which contain templates)
    const configs = await prisma.whatsAppConfig.findMany({
      where: { isConfigured: true },
      select: {
        id: true,
        storeId: true,
        templates: true,
        phoneNumberId: true,
      },
    });

    // Get store names
    const storeIds = configs.map(c => c.storeId);
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, storeName: true },
    });
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s.storeName]));

    // Flatten templates from all stores
    const allTemplates: any[] = [];
    for (const config of configs) {
      const templates = (config.templates as any[]) || [];
      for (const tpl of templates) {
        allTemplates.push({
          ...tpl,
          storeId: config.storeId,
          storeName: storeMap[config.storeId] || 'Unknown',
          configId: config.id,
        });
      }
    }

    return NextResponse.json({
      templates: allTemplates,
      totalStores: configs.length,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Admin templates GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
