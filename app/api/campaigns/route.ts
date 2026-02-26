export const dynamic = 'force-dynamic';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import type {
  Campaign,
  CampaignMessageContent,
  CampaignType,
} from '@/lib/types/campaign';
import type { CustomerSegment } from '@/lib/types/segment';
import type {
  ShopifyCustomer,
  ShopifyCustomerListResponse,
} from '@/lib/types/shopify-customer';
import { prisma } from '@/lib/prisma';
import {
  transformCampaign,
  transformCampaignToDb,
} from '@/lib/utils/db-transformers';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
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
    const client = getShopifyClient(request);

    const selectedSegments = await prisma.segment.findMany({
      where: {
        id: { in: segmentIds },
      },
    });

    if (selectedSegments.length === 0) return fallback;

    const customersResponse: ShopifyCustomerListResponse =
      await client.getCustomers({ limit: 250 });

    const customers = (customersResponse.customers ?? []) as ShopifyCustomer[];

    const matchingCustomers = customers.filter((customer) =>
      selectedSegments.every((segment) => {
        const conditionGroups = (segment.filters as any)?.conditionGroups || [];
        return matchesGroups(customer, conditionGroups);
      }),
    );

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
    const status =
      scheduleType === 'IMMEDIATE'
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
          scheduleType === 'IMMEDIATE' ? new Date() : null,
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

    const campaign = transformCampaign(dbCampaign);

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
