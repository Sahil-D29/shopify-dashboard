export const dynamic = 'force-dynamic';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import type {
  Campaign,
  CampaignMessageContent,
  CampaignType,
} from '@/lib/types/campaign';
import type { CustomerSegment } from '@/lib/types/segment';
import { prisma } from '@/lib/prisma';
import {
  transformCampaign,
  transformCampaignToDb,
} from '@/lib/utils/db-transformers';
import { getShopifyClientAsync } from '@/lib/shopify/api-helper';
import { resolveSegmentCustomers } from '@/lib/segments/resolve-customers';
import {
  filterByStoreId,
  ensureStoreId,
  getCurrentStoreId,
} from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type TimeRangeFilter = 'all' | '1month' | '2months' | '3months';

interface CampaignCreatePayload {
  name?: string;
  description?: string;
  type?: CampaignType;
  segmentIds?: string[];
  estimatedReach?: number;
  messageContent?: CampaignMessageContent;
  scheduleType?: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
  scheduledAt?: number;
  timezone?: string;
  sendingSpeed?: 'FAST' | 'MEDIUM' | 'SLOW';
  tags?: string[];
  labels?: string[];
  useSmartTiming?: boolean;
  status?: string;
}

const loadCampaigns = async (storeId?: string): Promise<Campaign[]> => {
  const campaigns = await prisma.campaign.findMany({
    where: storeId ? { storeId } : undefined,
    include: {
      segment: true,
      store: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return campaigns.map(transformCampaign);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseTimeRange = (value: string | null): TimeRangeFilter =>
  value === '1month' || value === '2months' || value === '3months'
    ? value
    : 'all';

const toDaysAgo = (timeRange: TimeRangeFilter): number => {
  switch (timeRange) {
    case '1month':
      return 30;
    case '2months':
      return 60;
    case '3months':
      return 90;
    default:
      return 0;
  }
};

const normaliseMessageContent = (
  content: CampaignMessageContent | undefined,
): CampaignMessageContent => ({
  body: content?.body ?? '',
  subject: content?.subject,
  media: content?.media,
  buttons: content?.buttons,
  variables: content?.variables,
});

const generateCampaignId = (): string =>
  `camp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const calculateEstimatedReach = async (
  request: NextRequest,
  segmentIds: string[] | undefined,
  fallback: number,
): Promise<number> => {
  if (!segmentIds || segmentIds.length === 0) return fallback;

  try {
    const client = await getShopifyClientAsync(request);
    const storeId = (await getCurrentStoreId(request)) || undefined;

    // Enrichment-correct resolution — must match the preview count and the actual send.
    const matchingCustomers = await resolveSegmentCustomers({
      client,
      storeId,
      segmentIds,
    });

    return matchingCustomers.length || fallback;
  } catch (error) {
    console.error(
      '[API] Error calculating estimatedReach from Shopify:',
      error,
    );
    return fallback;
  }
};

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);

    if (!userContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          campaigns: [],
        },
        { status: 401 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(
      userContext,
      requestedStoreId || undefined,
    );

    const { searchParams } = new URL(request.url);
    const timeRange = parseTimeRange(searchParams.get('timeRange'));

    let storeIdFilter: string | undefined;

    if (userContext.role === 'ADMIN') {
      storeIdFilter = requestedStoreId || undefined;
    } else if (userContext.role === 'STORE_OWNER') {
      storeIdFilter = userContext.storeId ?? undefined;
    } else {
      storeIdFilter =
        userContext.assignedStoreId ?? userContext.storeId ?? undefined;
    }

    let campaigns = await loadCampaigns(storeIdFilter);

    if (timeRange !== 'all') {
      const daysAgo = toDaysAgo(timeRange);
      if (daysAgo > 0) {
        const cutoffDate =
          Date.now() - daysAgo * 24 * 60 * 60 * 1000;
        campaigns = campaigns.filter(
          (campaign) => campaign.createdAt >= cutoffDate,
        );
      }
    }

    return NextResponse.json({
      success: true,
      campaigns,
    });
  } catch (error) {
    console.error('[API] Error fetching campaigns:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch campaigns',
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(
      userContext,
      requestedStoreId || undefined,
    );

    let storeId: string;

    if (storeFilter.allowAll) {
      storeId =
        requestedStoreId || userContext.storeId || 'default';
    } else if (storeFilter.storeId) {
      storeId = storeFilter.storeId;
    } else {
      return NextResponse.json(
        { error: 'Store context required' },
        { status: 400 },
      );
    }

    let data: CampaignCreatePayload;

    try {
      data = (await request.json()) as CampaignCreatePayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    if (!data.name) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 },
      );
    }

    const estimatedReach = await calculateEstimatedReach(
      request,
      data.segmentIds,
      data.estimatedReach ?? 0,
    );

    const scheduleType = data.scheduleType ?? 'IMMEDIATE';
    // An explicit DRAFT (Save as Draft) always wins over the schedule-derived status.
    const status =
      data.status === 'DRAFT'
        ? 'DRAFT'
        : scheduleType === 'IMMEDIATE'
        ? 'RUNNING'
        : data.scheduledAt
        ? 'SCHEDULED'
        : 'DRAFT';

    const userId = userContext.userId || 'user_1';

    const messageContent = normaliseMessageContent(
      data.messageContent,
    );

    const messageTemplate = JSON.parse(
      JSON.stringify({
        messageContent,
        body: messageContent.body,
        subject: messageContent.subject,
        media: messageContent.media,
        buttons: messageContent.buttons,
        variables: messageContent.variables,
      }),
    ) as Prisma.InputJsonValue;

    const campaignType = data.type || 'ONE_TIME';
    const validTypes = ['ONE_TIME', 'RECURRING', 'DRIP', 'TRIGGER_BASED'];
    const dbType = validTypes.includes(campaignType) ? campaignType : 'ONE_TIME';

    const dbCampaign = await prisma.campaign.create({
      data: {
        id: `camp_${randomUUID()}`,
        storeId,
        name: data.name,
        description: data.description ?? null,
        type: dbType as any,
        status:
          status === 'RUNNING'
            ? 'RUNNING'
            : status === 'SCHEDULED'
            ? 'SCHEDULED'
            : 'DRAFT',
        segmentId:
          data.segmentIds && data.segmentIds.length > 0
            ? data.segmentIds[0]
            : null,
        segmentIds: data.segmentIds ?? [],
        messageTemplate,
        scheduleType:
          scheduleType === 'IMMEDIATE'
            ? 'IMMEDIATE'
            : scheduleType === 'SCHEDULED'
            ? 'SCHEDULED'
            : 'RECURRING',
        scheduledAt: data.scheduledAt
          ? new Date(data.scheduledAt)
          : null,
        executedAt:
          status === 'RUNNING' && scheduleType === 'IMMEDIATE' ? new Date() : null,
        // Audience & Delivery
        estimatedReach,
        sendingSpeed: data.sendingSpeed ?? 'MEDIUM',
        timezone: data.timezone ?? 'Asia/Kolkata',
        useSmartTiming: data.useSmartTiming ?? false,
        templateId: (data as any).templateId ?? null,
        // Labels & Tags
        tags: data.tags ?? [],
        labels: data.labels ?? [],
        // Advanced config
        whatsappConfig: (data as any).whatsappConfig ?? undefined,
        abTestConfig: (data as any).abTest ?? undefined,
        dripSteps: (data as any).dripSteps ?? undefined,
        triggerEvent: (data as any).triggerEvent ?? null,
        triggerDelay: (data as any).triggerDelay ?? null,
        triggerConditions: (data as any).triggerConditions ?? undefined,
        goalTracking: (data as any).goalTracking ?? undefined,
        recurringConfig: (data as any).recurringConfig ?? undefined,
        // Metrics
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalFailed: 0,
        totalConverted: 0,
        totalUnsubscribed: 0,
        totalRevenue: 0,
        createdBy: userId,
      },
      include: {
        segment: true,
        store: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Save follow-up steps if provided
    const followUpSteps = (data as any).followUpSteps as
      | Array<{
          id?: string;
          stepIndex: number;
          name: string;
          condition: string;
          delayMinutes: number;
          messageBody: string;
          templateName?: string;
          useSmartWindow?: boolean;
        }>
      | undefined;

    if (followUpSteps && followUpSteps.length > 0) {
      await prisma.campaignFollowUp.createMany({
        data: followUpSteps.map((step) => ({
          campaignId: dbCampaign.id,
          stepIndex: step.stepIndex,
          name: step.name,
          condition: step.condition,
          delayMinutes: step.delayMinutes,
          messageBody: step.messageBody,
          templateName: step.templateName ?? null,
          useSmartWindow: step.useSmartWindow ?? true,
          isActive: true,
        })),
      });
    }

    // Enqueue the campaign for delivery. Without a queue item the send worker
    // has nothing to process, which is why campaigns previously sat on RUNNING
    // with 0 sent and no error.
    if (status === 'RUNNING' || status === 'SCHEDULED') {
      try {
        await prisma.campaignQueueItem.create({
          data: {
            campaignId: dbCampaign.id,
            storeId,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
            status: 'PENDING',
          },
        });
      } catch (enqueueError) {
        console.error('[API] Failed to enqueue campaign:', enqueueError);
      }
    }

    // Immediate campaigns: run the worker inline so the user gets instant
    // feedback (sent counts, or a FAILED status with the reason) instead of a
    // campaign that silently stays on RUNNING. Best-effort — never blocks the
    // response from succeeding.
    if (status === 'RUNNING') {
      try {
        const { runCampaignWorkerStep } = await import('@/jobs/campaign.worker');
        for (let i = 0; i < 3; i++) {
          const result = await runCampaignWorkerStep();
          if (!result.processed) break;
        }
      } catch (runError) {
        console.error('[API] Inline campaign run failed:', runError);
      }
    }

    const refreshed = await prisma.campaign.findUnique({
      where: { id: dbCampaign.id },
      include: {
        segment: true,
        store: true,
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    const campaign = transformCampaign(refreshed ?? dbCampaign);

    return NextResponse.json({ campaign, success: true });
  } catch (error) {
    console.error('[API] Error creating campaign:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
