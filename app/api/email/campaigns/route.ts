export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const VALID_STATUSES = new Set([
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

const VALID_AUDIENCE_MODES = new Set(['ALL_SUBSCRIBERS', 'SEGMENTS']);
const VALID_SCHEDULE_TYPES = new Set(['IMMEDIATE', 'SCHEDULED']);

interface CreateCampaignPayload {
  name?: string;
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  preheaderText?: string | null;
  htmlBody?: string;
  templateId?: string | null;
  audienceMode?: string;
  segmentIds?: string[];
  scheduleType?: string;
  scheduledAt?: string | null;
  abTestEnabled?: boolean;
  abTestPercent?: number;
  abTestVariantSubject?: string | null;
  abTestWinnerMetric?: string;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseInt32 = (value: string | null, fallback: number, max = 200): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', campaigns: [] },
        { status: 401 },
      );
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const url = request.nextUrl;
    const status = url.searchParams.get('status');
    const limit = parseInt32(url.searchParams.get('limit'), 50);
    const offset = parseInt32(url.searchParams.get('offset'), 0, 10_000);

    const where: any = storeFilter.allowAll
      ? {}
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId }
        : { storeId: '__none__' };
    if (status && VALID_STATUSES.has(status)) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    return NextResponse.json({ success: true, campaigns, total, limit, offset });
  } catch (error) {
    console.error('[Email Campaigns][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load campaigns',
        details: getErrorMessage(error),
        campaigns: [],
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

    let body: CreateCampaignPayload;
    try {
      body = (await request.json()) as CreateCampaignPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const errors: string[] = [];
    if (!body.name?.trim()) errors.push('name is required');
    if (!body.subject?.trim()) errors.push('subject is required');
    if (!body.fromName?.trim()) errors.push('fromName is required');
    if (!body.fromEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.fromEmail)) {
      errors.push('fromEmail must be a valid email address');
    }
    if (errors.length) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const audienceMode =
      body.audienceMode && VALID_AUDIENCE_MODES.has(body.audienceMode)
        ? body.audienceMode
        : 'ALL_SUBSCRIBERS';
    const scheduleType =
      body.scheduleType && VALID_SCHEDULE_TYPES.has(body.scheduleType)
        ? body.scheduleType
        : 'IMMEDIATE';

    const scheduledAt =
      scheduleType === 'SCHEDULED' && body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (scheduleType === 'SCHEDULED' && (!scheduledAt || isNaN(scheduledAt.getTime()))) {
      return NextResponse.json(
        { error: 'scheduledAt is required and must be a valid date when scheduleType is SCHEDULED' },
        { status: 400 },
      );
    }

    const abTestPercent =
      typeof body.abTestPercent === 'number' && body.abTestPercent >= 1 && body.abTestPercent <= 50
        ? Math.floor(body.abTestPercent)
        : 20;

    const campaign = await prisma.emailCampaign.create({
      data: {
        storeId,
        name: body.name!.trim(),
        subject: body.subject!.trim(),
        fromName: body.fromName!.trim(),
        fromEmail: body.fromEmail!.trim().toLowerCase(),
        replyTo: body.replyTo?.trim() || null,
        preheaderText: body.preheaderText?.trim() || null,
        htmlBody: body.htmlBody ?? '',
        templateId: body.templateId ?? null,
        audienceMode,
        segmentIds: Array.isArray(body.segmentIds) ? body.segmentIds : [],
        status: 'DRAFT',
        scheduleType: scheduleType as any,
        scheduledAt,
        abTestEnabled: Boolean(body.abTestEnabled),
        abTestPercent,
        abTestVariantSubject: body.abTestVariantSubject?.trim() || null,
        abTestWinnerMetric: body.abTestWinnerMetric === 'CLICK_RATE' ? 'CLICK_RATE' : 'OPEN_RATE',
        createdBy: userContext.userId,
      },
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    console.error('[Email Campaigns][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
