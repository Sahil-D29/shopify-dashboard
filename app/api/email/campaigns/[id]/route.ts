export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const VALID_AUDIENCE_MODES = new Set(['ALL_SUBSCRIBERS', 'SEGMENTS']);
const VALID_SCHEDULE_TYPES = new Set(['IMMEDIATE', 'SCHEDULED']);

async function loadAccessible(
  request: NextRequest,
  id: string,
): Promise<
  | { ok: true; storeFilter: { allowAll: boolean; storeId?: string }; campaign: any }
  | { ok: false; response: NextResponse }
> {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const requestedStoreId = await getCurrentStoreId(request);
  const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }),
    };
  }
  if (!storeFilter.allowAll && campaign.storeId !== storeFilter.storeId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    };
  }
  return { ok: true, storeFilter, campaign };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    // Include recent sends for the detail page
    const recentSends = await prisma.emailCampaignSend.findMany({
      where: { campaignId: id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      campaign: result.campaign,
      recentSends,
    });
  } catch (error) {
    console.error('[Email Campaigns][GET id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load campaign', details: getErrorMessage(error) },
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

    if (
      result.campaign.status === 'SENDING' ||
      result.campaign.status === 'COMPLETED'
    ) {
      return NextResponse.json(
        { error: `Cannot edit a campaign in ${result.campaign.status} status` },
        { status: 400 },
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.subject === 'string' && body.subject.trim()) data.subject = body.subject.trim();
    if (typeof body.fromName === 'string' && body.fromName.trim()) data.fromName = body.fromName.trim();
    if (typeof body.fromEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.fromEmail)) {
      data.fromEmail = body.fromEmail.trim().toLowerCase();
    }
    if (body.replyTo !== undefined) data.replyTo = body.replyTo?.trim() || null;
    if (body.preheaderText !== undefined) data.preheaderText = body.preheaderText?.trim() || null;
    if (typeof body.htmlBody === 'string') data.htmlBody = body.htmlBody;
    if (body.templateId !== undefined) data.templateId = body.templateId || null;
    if (typeof body.audienceMode === 'string' && VALID_AUDIENCE_MODES.has(body.audienceMode)) {
      data.audienceMode = body.audienceMode;
    }
    if (Array.isArray(body.segmentIds)) data.segmentIds = body.segmentIds;
    if (typeof body.scheduleType === 'string' && VALID_SCHEDULE_TYPES.has(body.scheduleType)) {
      data.scheduleType = body.scheduleType;
    }
    if (body.scheduledAt !== undefined) {
      data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }
    if (typeof body.abTestEnabled === 'boolean') data.abTestEnabled = body.abTestEnabled;
    if (
      typeof body.abTestPercent === 'number' &&
      body.abTestPercent >= 1 &&
      body.abTestPercent <= 50
    ) {
      data.abTestPercent = Math.floor(body.abTestPercent);
    }
    if (body.abTestVariantSubject !== undefined) {
      data.abTestVariantSubject = body.abTestVariantSubject?.trim() || null;
    }
    if (body.abTestWinnerMetric === 'OPEN_RATE' || body.abTestWinnerMetric === 'CLICK_RATE') {
      data.abTestWinnerMetric = body.abTestWinnerMetric;
    }

    // Reflect scheduling state into status: editing a SCHEDULED campaign back to
    // IMMEDIATE drops it to DRAFT; editing a DRAFT with a scheduledAt sets SCHEDULED.
    const nextScheduleType = data.scheduleType ?? result.campaign.scheduleType;
    if (nextScheduleType === 'SCHEDULED') {
      if (result.campaign.status === 'DRAFT' && data.scheduledAt) data.status = 'SCHEDULED';
    } else if (nextScheduleType === 'IMMEDIATE') {
      if (result.campaign.status === 'SCHEDULED') data.status = 'DRAFT';
      data.scheduledAt = null;
    }

    const campaign = await prisma.emailCampaign.update({ where: { id }, data });
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error('[Email Campaigns][PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign', details: getErrorMessage(error) },
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
    if (result.campaign.status === 'SENDING') {
      return NextResponse.json(
        { error: 'Cannot delete a campaign that is currently sending. Cancel it first.' },
        { status: 400 },
      );
    }
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Campaigns][DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
