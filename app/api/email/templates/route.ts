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

interface CreateTemplatePayload {
  name?: string;
  description?: string;
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

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', templates: [] },
        { status: 401 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    // Store-scoped templates + global built-ins are always returned
    const where = storeFilter.allowAll
      ? undefined
      : storeFilter.storeId
        ? { OR: [{ storeId: storeFilter.storeId }, { isGlobal: true }] }
        : { isGlobal: true };

    const category = request.nextUrl.searchParams.get('category');
    const filteredWhere =
      category && ALLOWED_CATEGORIES.has(category)
        ? where
          ? { AND: [where, { category }] }
          : { category }
        : where;

    const templates = await prisma.emailTemplate.findMany({
      where: filteredWhere,
      orderBy: [{ isGlobal: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error('[Email Templates][GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load templates', details: getErrorMessage(error), templates: [] },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    let storeId: string | null;
    if (storeFilter.allowAll) {
      storeId = requestedStoreId || userContext.storeId || null;
    } else if (storeFilter.storeId) {
      storeId = storeFilter.storeId;
    } else {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    let body: CreateTemplatePayload;
    try {
      body = (await request.json()) as CreateTemplatePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const category =
      body.category && ALLOWED_CATEGORIES.has(body.category) ? body.category : 'custom';

    const template = await prisma.emailTemplate.create({
      data: {
        storeId,
        name: body.name.trim(),
        description: body.description ?? null,
        category,
        subject: body.subject ?? '',
        preheaderText: body.preheaderText ?? '',
        htmlBody: body.htmlBody ?? '',
        mjmlBody: body.mjmlBody ?? '',
        jsonDesign: (body.jsonDesign ?? null) as any,
        thumbnailUrl: body.thumbnailUrl ?? null,
        isGlobal: false,
        tags: Array.isArray(body.tags) ? body.tags : [],
        createdBy: userContext.userId,
      },
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('[Email Templates][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create template', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
