export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

/**
 * Assign a predefined template to specific stores or all stores.
 * This creates journey drafts in target stores from the template definition.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const { storeIds } = body; // array of storeIds or 'all'

    const template = await prisma.predefinedTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get target stores
    let stores;
    if (storeIds === 'all') {
      stores = await prisma.store.findMany({ select: { id: true } });
    } else if (Array.isArray(storeIds) && storeIds.length > 0) {
      stores = await prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { id: true },
      });
    } else {
      return NextResponse.json({ error: 'storeIds must be an array of store IDs or "all"' }, { status: 400 });
    }

    // Map category to trigger type
    const categoryToTrigger: Record<string, string> = {
      abandoned_cart: 'CHECKOUT_ABANDONED',
      product_view: 'CUSTOM',
      cart_reminder: 'CUSTOM',
      checkout: 'ORDER_CREATED',
      order_confirmation: 'ORDER_CREATED',
      welcome: 'CUSTOMER_CREATED',
      re_engagement: 'CUSTOM',
      custom: 'CUSTOM',
    };

    const triggerType = categoryToTrigger[template.category] || 'CUSTOM';

    // Create journey drafts for each store
    const results: Array<{ storeId: string; journeyId?: string; status: string }> = [];

    for (const store of stores) {
      try {
        // Check if a journey with the same name already exists for this store
        const existing = await prisma.journey.findFirst({
          where: { storeId: store.id, name: template.name },
        });

        if (existing) {
          results.push({ storeId: store.id, status: 'already_exists' });
          continue;
        }

        const journey = await prisma.journey.create({
          data: {
            storeId: store.id,
            name: template.name,
            description: template.description || `Auto-created from template: ${template.name}`,
            definition: template.definition as any,
            status: 'DRAFT',
            triggerType: triggerType as any,
            triggerConfig: {},
          },
        });

        results.push({ storeId: store.id, journeyId: journey.id, status: 'created' });
      } catch (err) {
        console.error(`Failed to create journey for store ${store.id}:`, err);
        results.push({ storeId: store.id, status: 'error' });
      }
    }

    // Update the template's assignedTo
    const assignedStoreIds = storeIds === 'all' ? null : storeIds;
    await prisma.predefinedTemplate.update({
      where: { id },
      data: { assignedTo: assignedStoreIds },
    });

    return NextResponse.json({
      success: true,
      totalStores: stores.length,
      created: results.filter(r => r.status === 'created').length,
      alreadyExists: results.filter(r => r.status === 'already_exists').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Template assign error:', error);
    return NextResponse.json({ error: 'Failed to assign template' }, { status: 500 });
  }
}
