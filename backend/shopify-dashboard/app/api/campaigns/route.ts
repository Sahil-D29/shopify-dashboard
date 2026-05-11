import { NextRequest, NextResponse } from 'next/server';
import type { Campaign, CampaignMessageContent, CampaignType } from '@/lib/types/campaign';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer, ShopifyCustomerResponse } from '@/lib/types/shopify-customer';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
import { filterByStoreId, ensureStoreId, getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

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

const loadCampaigns = (): Campaign[] => readJsonFile<Campaign>('campaigns.json');

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseTimeRange = (value: string | null): TimeRangeFilter =>
  value === '1month' || value === '2months' || value === '3months' ? value : 'all';

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

const normaliseMessageContent = (content: CampaignMessageContent | undefined): CampaignMessageContent => ({
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
    const segments = readJsonFile<CustomerSegment>('segments.json');
    const selectedSegments = segments.filter(segment => segmentIds.includes(segment.id));
    if (selectedSegments.length === 0) return fallback;

    const customersResponse: ShopifyCustomerResponse = await client.getCustomers({ limit: 250 });
    const customers = (customersResponse.customers ?? []) as ShopifyCustomer[];

    const matchingCustomers = customers.filter(customer =>
      selectedSegments.every(segment => matchesGroups(customer, segment.conditionGroups ?? [])),
    );

    return matchingCustomers.length || fallback;
  } catch (error) {
    console.error('[API] Error calculating estimatedReach from Shopify:', error);
    return fallback;
  }
};

export async function GET(request: NextRequest) {
  try {
    // Get user context for role-based access
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          campaigns: [] 
        },
        { status: 401 }
      );
    }

    // Get store ID from request
    const requestedStoreId = await getCurrentStoreId(request);
    
    // Build store filter based on user role
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
    
    const { searchParams } = new URL(request.url);
    const timeRange = parseTimeRange(searchParams.get('timeRange'));

    let campaigns = loadCampaigns();
    
    // Flexible filtering - show all data including legacy (null/default/empty storeId)
    if (userContext.role === 'ADMIN') {
      // Admin sees everything - no filtering
      // campaigns already contains all campaigns
    } else if (userContext.role === 'STORE_OWNER') {
      // Store owner sees their store + any legacy data (null/default/empty storeId)
      const userStoreId = userContext.storeId;
      campaigns = campaigns.filter(c => {
        // Include if matches user's store
        if (c.storeId === userStoreId) return true;
        // Include legacy data (no storeId or default values)
        if (!c.storeId || c.storeId === 'default' || c.storeId === '' || c.storeId === null) return true;
        return false;
      });
    } else {
      // USER sees assigned store + legacy data
      const userStoreId = userContext.assignedStoreId || userContext.storeId;
      campaigns = campaigns.filter(c => {
        // Include if matches user's assigned store
        if (c.storeId === userStoreId) return true;
        // Include legacy data (no storeId or default values)
        if (!c.storeId || c.storeId === 'default' || c.storeId === '' || c.storeId === null) return true;
        return false;
      });
    }

    // Apply time range filter
    if (timeRange !== 'all') {
      const daysAgo = toDaysAgo(timeRange);
      if (daysAgo > 0) {
        const cutoffDate = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
        campaigns = campaigns.filter(campaign => campaign.createdAt >= cutoffDate);
      }
    }

    return NextResponse.json({ 
      success: true,
      campaigns 
    });
  } catch (error) {
    console.error('[API] Error fetching campaigns:', error);
    // Return 200 with empty array to prevent frontend crashes
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
    // Get user context
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get store ID based on role
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
    
    // Determine effective store ID
    let storeId: string;
    if (storeFilter.allowAll) {
      // ADMIN can create campaigns for any store, use requested or default
      storeId = requestedStoreId || userContext.storeId || 'default';
    } else if (storeFilter.storeId) {
      storeId = storeFilter.storeId;
    } else {
      return NextResponse.json(
        { error: 'Store context required' },
        { status: 400 }
      );
    }
    
    const data = (await request.json()) as CampaignCreatePayload;

    if (!data.name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    const estimatedReach = await calculateEstimatedReach(request, data.segmentIds, data.estimatedReach ?? 0);
    const timestamp = Date.now();
    const scheduleType = data.scheduleType ?? 'IMMEDIATE';
    const status =
      scheduleType === 'IMMEDIATE'
        ? 'RUNNING'
        : data.scheduledAt
        ? 'SCHEDULED'
        : 'DRAFT';

    const campaign: Campaign = {
      id: generateCampaignId(),
      name: data.name,
      description: data.description ?? '',
      type: data.type ?? 'ONE_TIME',
      channel: 'WHATSAPP',
      status,
      segmentIds: data.segmentIds ?? [],
      estimatedReach,
      messageContent: normaliseMessageContent(data.messageContent),
      scheduleType,
      scheduledAt: data.scheduledAt,
      timezone: data.timezone ?? 'Asia/Kolkata',
      sendingSpeed: data.sendingSpeed ?? 'MEDIUM',
      metrics: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        failed: 0,
        unsubscribed: 0,
        revenue: 0,
      },
      createdBy: 'user_1',
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: scheduleType === 'IMMEDIATE' ? timestamp : undefined,
      tags: data.tags ?? [],
      labels: data.labels ?? [],
      useSmartTiming: data.useSmartTiming ?? false,
      storeId, // Add storeId
    };

    const campaigns = loadCampaigns();
    campaigns.push(campaign);
    writeJsonFile('campaigns.json', campaigns);

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

