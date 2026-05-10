import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { CustomerSegment } from '@/lib/types/segment';
import { calculateSegmentStatsFromFiles } from '@/lib/utils/segment-stats-file-based';
import type { JourneyDefinition } from '@/lib/types/journey';
import type { Campaign } from '@/lib/types/campaign';
import type { JourneyEnrollmentRecord } from '@/lib/journey-engine/storage';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

export const runtime = 'nodejs';

interface RouteParams {
  id: string;
}

// Removed Shopify-based types - now using file-based calculation

const parseBoolean = (value: string | null): boolean => value === 'true';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const resolveParams = async (params: RouteParams | Promise<RouteParams>): Promise<RouteParams> =>
  params instanceof Promise ? params : Promise.resolve(params);

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  try {
    const { id: segmentId } = await resolveParams(params);

    // Get user context for store filtering
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const segments = readJsonFile<CustomerSegment>('segments.json');
    
    // Filter segments based on user role and store access
    let filteredSegments = segments;
    if (userContext.role === 'STORE_OWNER') {
      const userStoreId = userContext.storeId;
      filteredSegments = segments.filter(s => {
        if (s.storeId === userStoreId) return true;
        if (!s.storeId || s.storeId === 'default' || s.storeId === '' || s.storeId === null) return true;
        return false;
      });
    } else if (userContext.role === 'USER') {
      const userStoreId = userContext.assignedStoreId || userContext.storeId;
      filteredSegments = segments.filter(s => {
        if (s.storeId === userStoreId) return true;
        if (!s.storeId || s.storeId === 'default' || s.storeId === '' || s.storeId === null) return true;
        return false;
      });
    }
    // ADMIN sees all segments - no filtering needed

    const segment = filteredSegments.find(s => s.id === segmentId);

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const refresh = parseBoolean(request.nextUrl.searchParams.get('refresh'));

    // Calculate stats from file-based customer data (same as list endpoint)
    const stats = await calculateSegmentStatsFromFiles({
      segmentId: segment.id,
      conditionGroups: segment.conditionGroups,
      storeId: storeFilter.storeId || undefined,
      forceRefresh: refresh,
    });

    // Get customers for the detail view (filtered by segment conditions)
    const customers = readJsonFile<any>('customers.json');
    let filteredCustomers: any[] = [];
    
    if (customers && customers.length > 0) {
      const conditionGroups = segment.conditionGroups || [];
      const hasConditions = conditionGroups.length > 0 && 
        conditionGroups.some(group => (group.conditions || []).length > 0);
      
      if (hasConditions) {
        const { matchesGroups } = await import('@/lib/segments/evaluator');
        filteredCustomers = customers.filter((customer: any) => {
          try {
            return matchesGroups(customer, conditionGroups);
          } catch (error) {
            return false;
          }
        });
      } else {
        filteredCustomers = customers;
      }
    }

    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const journeys = readJsonFile<JourneyDefinition>('journeys.json');

    const campaignsUsing = campaigns.filter(c => Array.isArray(c.segmentIds) && c.segmentIds.includes(segmentId));
    const activeCampaigns = campaignsUsing.filter(c => ['RUNNING', 'SCHEDULED', 'ACTIVE'].includes(c.status)).length;

    const journeysUsing = journeys.filter(journey => {
      const entryMatch = journey.settings?.entry?.segmentId === segmentId;
      const triggerMatch = journey.nodes?.some(node => node.type === 'trigger' && node.trigger?.segmentId === segmentId);
      return entryMatch || triggerMatch;
    });
    const activeJourneys = journeysUsing.filter(journey => journey.status === 'ACTIVE').length;

    return NextResponse.json({
      segment: {
        ...segment,
        customerCount: stats.customerCount,
        totalValue: stats.totalValue,
        totalRevenue: stats.totalValue, // Keep for backward compatibility
        totalOrders: stats.totalOrders,
        averageOrderValue: stats.avgOrderValue,
        lastUpdated: stats.lastUpdated,
        lastCalculated: stats.lastUpdated, // Keep for backward compatibility
        customers: filteredCustomers.slice(0, 100), // Limit to 100 for detail view
        usingCachedStats: false, // File-based, not cached
        usage: {
          campaigns: campaignsUsing.length,
          activeCampaigns,
          journeys: journeysUsing.length,
          activeJourneys,
        },
      },
    });
  } catch (error) {
    console.error('[Segments][GET /:id] Error fetching segment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const data = (await request.json()) as Partial<CustomerSegment>;
    const { id: segmentId } = await resolveParams(params);

    const segments = readJsonFile<CustomerSegment>('segments.json');
    const index = segments.findIndex(s => s.id === segmentId);

    if (index === -1) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    if (segments[index].isSystem) {
      return NextResponse.json(
        { error: 'System segments cannot be updated' },
        { status: 400 }
      );
    }

    const updatedSegment = {
      ...segments[index],
      ...data,
      id: segmentId,
      updatedAt: Date.now(),
    } satisfies CustomerSegment;

    segments[index] = updatedSegment;
    writeJsonFile('segments.json', segments);

    return NextResponse.json({ segment: updatedSegment });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id: segmentId } = await resolveParams(params);

    if (!segmentId) {
      console.warn('[Segments][DELETE] Missing segment id in request params');
      return NextResponse.json(
        { error: 'Segment id is required' },
        { status: 400 }
      );
    }

    const segments = readJsonFile<CustomerSegment>('segments.json');
    const segment = segments.find(s => s.id === segmentId);

    if (!segment) {
      console.warn('[Segments][DELETE] Segment not found', { segmentId });
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    if (segment.isSystem) {
      console.warn('[Segments][DELETE] Attempt to delete system segment', { segmentId });
      return NextResponse.json(
        { error: 'System segments cannot be deleted' },
        { status: 400 }
      );
    }

    const updatedSegments = segments.filter(s => s.id !== segmentId);
    writeJsonFile('segments.json', updatedSegments);

    console.info('[Segments][DELETE] Segment removed from store', {
      segmentId,
      previousCount: segments.length,
      nextCount: updatedSegments.length,
    });

    const campaigns = readJsonFile<Campaign>('campaigns.json');
    let campaignsUpdated = 0;
    const sanitizedCampaigns = campaigns.map(campaign => {
      if (!Array.isArray(campaign.segmentIds)) return campaign;
      if (!campaign.segmentIds.includes(segmentId)) return campaign;
      campaignsUpdated += 1;
      return {
        ...campaign,
        segmentIds: campaign.segmentIds.filter((id: string) => id !== segmentId),
      };
    });
    writeJsonFile('campaigns.json', sanitizedCampaigns);

    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    let journeysUpdated = 0;
    const sanitizedJourneys = journeys.map(journey => {
      let updated = false;
      const nextJourney = { ...journey } as JourneyDefinition;

      if (nextJourney.settings?.entry?.segmentId === segmentId) {
        updated = true;
        nextJourney.settings = {
          ...nextJourney.settings,
          entry: {
            ...nextJourney.settings.entry,
            segmentId: undefined,
          },
        };
      }

      if (Array.isArray(nextJourney.nodes) && nextJourney.nodes.length > 0) {
        nextJourney.nodes = nextJourney.nodes.map(node => {
          if (node.type === 'trigger' && node.trigger?.segmentId === segmentId) {
            updated = true;
            return {
              ...node,
              trigger: {
                ...node.trigger,
                segmentId: undefined,
              },
            };
          }
          return node;
        });
      }

      if (updated) journeysUpdated += 1;
      return nextJourney;
    });
    writeJsonFile('journeys.json', sanitizedJourneys);

    const enrollments = readJsonFile<JourneyEnrollmentRecord>('journey-enrollments.json');
    const filteredEnrollments = enrollments.filter(enrollment => enrollment.segmentId !== segmentId);
    if (filteredEnrollments.length !== enrollments.length) {
      writeJsonFile('journey-enrollments.json', filteredEnrollments);
    }

    return NextResponse.json({
      success: true,
      message: 'Segment deleted',
      removedFromCampaigns: campaignsUpdated,
      updatedJourneys: journeysUpdated,
    });
  } catch (error) {
    console.error('[Segments][DELETE] Failed to delete segment', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

