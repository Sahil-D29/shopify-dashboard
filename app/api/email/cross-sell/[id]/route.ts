export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const VALID_STATUSES = new Set(['ACTIVE', 'PAUSED', 'DRAFT']);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function loadAccessible(request: NextRequest, id: string) {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const requestedStoreId = await getCurrentStoreId(request);
  const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
  const rule = await prisma.crossSellRule.findUnique({ where: { id } });
  if (!rule) {
    return { ok: false as const, response: NextResponse.json({ error: 'Rule not found' }, { status: 404 }) };
  }
  if (!storeFilter.allowAll && rule.storeId !== storeFilter.storeId) {
    return { ok: false as const, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }
  return { ok: true as const, rule };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    const recentLogs = await prisma.crossSellLog.findMany({
      where: { ruleId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, rule: result.rule, recentLogs });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load rule', details: getErrorMessage(error) },
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
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description;
    if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
      data.status = body.status;
    }
    if (Array.isArray(body.sourceProductIds)) {
      data.sourceProductIds = body.sourceProductIds
        .filter((s: unknown) => typeof s === 'string' && s.trim())
        .map((s: string) => s.trim());
    }
    if (Array.isArray(body.targetProductIds)) {
      data.targetProductIds = body.targetProductIds
        .filter((s: unknown) => typeof s === 'string' && s.trim())
        .map((s: string) => s.trim());
    }
    if (
      typeof body.emailDelayHours === 'number' &&
      body.emailDelayHours >= 0 &&
      body.emailDelayHours <= 720
    ) {
      data.emailDelayHours = Math.floor(body.emailDelayHours);
    }
    if (body.templateId !== undefined) data.templateId = body.templateId || null;
    if (typeof body.subject === 'string' && body.subject.trim()) data.subject = body.subject.trim();
    if (typeof body.fromName === 'string' && body.fromName.trim()) data.fromName = body.fromName.trim();
    if (
      typeof body.fromEmail === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.fromEmail)
    ) {
      data.fromEmail = body.fromEmail.trim().toLowerCase();
    }
    if (typeof body.htmlBody === 'string') data.htmlBody = body.htmlBody;
    if (body.jsonDesign !== undefined) data.jsonDesign = body.jsonDesign;

    const rule = await prisma.crossSellRule.update({ where: { id }, data });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update rule', details: getErrorMessage(error) },
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
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;
    await prisma.crossSellRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete rule', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
