export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const VALID_STATUSES = new Set(['ACTIVE', 'PAUSED', 'DRAFT']);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface CreateRulePayload {
  name?: string;
  description?: string | null;
  status?: string;
  sourceProductIds?: string[];
  targetProductIds?: string[];
  emailDelayHours?: number;
  templateId?: string | null;
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  htmlBody?: string;
  jsonDesign?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', rules: [] },
        { status: 401 },
      );
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const where: any = storeFilter.allowAll
      ? {}
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId }
        : { storeId: '__none__' };

    const rules = await prisma.crossSellRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error('[CrossSell][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load rules',
        details: getErrorMessage(error),
        rules: [],
      },
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
    } else {
      storeId = storeFilter.storeId || null;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    let body: CreateRulePayload;
    try {
      body = (await request.json()) as CreateRulePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!body.fromEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.fromEmail)) {
      return NextResponse.json({ error: 'fromEmail must be a valid email' }, { status: 400 });
    }
    if (!body.fromName?.trim()) {
      return NextResponse.json({ error: 'fromName is required' }, { status: 400 });
    }

    const status =
      body.status && VALID_STATUSES.has(body.status) ? (body.status as any) : 'DRAFT';
    const emailDelayHours =
      typeof body.emailDelayHours === 'number' &&
      body.emailDelayHours >= 0 &&
      body.emailDelayHours <= 720
        ? Math.floor(body.emailDelayHours)
        : 24;

    const rule = await prisma.crossSellRule.create({
      data: {
        storeId,
        name: body.name.trim(),
        description: body.description ?? null,
        status,
        sourceProductIds: Array.isArray(body.sourceProductIds)
          ? body.sourceProductIds.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim())
          : [],
        targetProductIds: Array.isArray(body.targetProductIds)
          ? body.targetProductIds.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim())
          : [],
        emailDelayHours,
        templateId: body.templateId ?? null,
        subject: body.subject?.trim() || 'You might also love these',
        fromName: body.fromName.trim(),
        fromEmail: body.fromEmail.trim().toLowerCase(),
        htmlBody: body.htmlBody ?? '',
        jsonDesign: (body.jsonDesign ?? null) as any,
        createdBy: userContext.userId,
      },
    });

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (error) {
    console.error('[CrossSell][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create rule', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
