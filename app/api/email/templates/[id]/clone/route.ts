export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function POST(
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

    let storeId: string | null;
    if (storeFilter.allowAll) {
      storeId = requestedStoreId || userContext.storeId || null;
    } else if (storeFilter.storeId) {
      storeId = storeFilter.storeId;
    } else {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    const source = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Source must be either a global template or one in the user's accessible store
    const canRead = source.isGlobal || storeFilter.allowAll || source.storeId === storeFilter.storeId;
    if (!canRead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let payload: { name?: string } = {};
    try {
      payload = (await request.json().catch(() => ({}))) as { name?: string };
    } catch {
      payload = {};
    }

    const clone = await prisma.emailTemplate.create({
      data: {
        storeId,
        name: payload.name?.trim() || `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        subject: source.subject,
        preheaderText: source.preheaderText,
        htmlBody: source.htmlBody,
        mjmlBody: source.mjmlBody,
        jsonDesign: (source.jsonDesign ?? null) as any,
        thumbnailUrl: source.thumbnailUrl,
        isGlobal: false,
        tags: source.tags,
        createdBy: userContext.userId,
      },
    });

    return NextResponse.json({ success: true, template: clone }, { status: 201 });
  } catch (error) {
    console.error('[Email Templates][CLONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clone template', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
