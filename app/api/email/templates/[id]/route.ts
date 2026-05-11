export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const ALLOWED_CATEGORIES = new Set([
  'welcome',
  'abandoned_cart',
  'transactional',
  'promotional',
  'winback',
  'notification',
  'post_purchase',
  'newsletter',
  'custom',
]);

interface UpdateTemplatePayload {
  name?: string;
  description?: string | null;
  category?: string;
  subject?: string;
  preheaderText?: string;
  htmlBody?: string;
  mjmlBody?: string;
  jsonDesign?: unknown;
  thumbnailUrl?: string | null;
  tags?: string[];
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const canAccessTemplate = (
  template: { storeId: string | null; isGlobal: boolean },
  storeFilter: { allowAll: boolean; storeId?: string },
): boolean => {
  if (template.isGlobal) return true;
  if (storeFilter.allowAll) return true;
  return Boolean(storeFilter.storeId && template.storeId === storeFilter.storeId);
};

const canMutateTemplate = (
  template: { storeId: string | null; isGlobal: boolean },
  storeFilter: { allowAll: boolean; storeId?: string },
): boolean => {
  if (template.isGlobal && !storeFilter.allowAll) return false;
  return canAccessTemplate(template, storeFilter);
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!canAccessTemplate(template, storeFilter)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('[Email Templates][GET id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load template', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!canMutateTemplate(existing, storeFilter)) {
      return NextResponse.json({ error: 'Cannot modify this template' }, { status: 403 });
    }

    let patch: UpdateTemplatePayload;
    try {
      patch = (await request.json()) as UpdateTemplatePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof patch.name === 'string' && patch.name.trim()) data.name = patch.name.trim();
    if (patch.description !== undefined) data.description = patch.description;
    if (typeof patch.category === 'string') {
      data.category = ALLOWED_CATEGORIES.has(patch.category) ? patch.category : 'custom';
    }
    if (typeof patch.subject === 'string') data.subject = patch.subject;
    if (typeof patch.preheaderText === 'string') data.preheaderText = patch.preheaderText;
    if (typeof patch.htmlBody === 'string') data.htmlBody = patch.htmlBody;
    if (typeof patch.mjmlBody === 'string') data.mjmlBody = patch.mjmlBody;
    if (patch.jsonDesign !== undefined) data.jsonDesign = patch.jsonDesign;
    if (patch.thumbnailUrl !== undefined) data.thumbnailUrl = patch.thumbnailUrl;
    if (Array.isArray(patch.tags)) data.tags = patch.tags;

    const template = await prisma.emailTemplate.update({ where: { id }, data });
    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('[Email Templates][PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update template', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.isGlobal) {
      return NextResponse.json({ error: 'Cannot delete built-in templates' }, { status: 403 });
    }
    if (!canMutateTemplate(existing, storeFilter)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.emailTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Templates][DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
