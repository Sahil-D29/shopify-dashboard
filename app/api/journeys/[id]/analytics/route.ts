export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import {
  computeJourneyAnalytics,
  toJourneyMetrics,
  toNodePerformance,
  toMessagePerformance,
  toGoalFunnel,
  toExperimentResults,
  toAudienceBreakdown,
  toJourneyUsers,
  type AnalyticsFilters,
} from '@/lib/journey-engine/analytics';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: journeyId } = await params;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const goalAchievedParam = searchParams.get('goalAchieved');

    const filters: AnalyticsFilters = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      status:
        statusParam === 'active' ||
        statusParam === 'completed' ||
        statusParam === 'waiting' ||
        statusParam === 'exited' ||
        statusParam === 'failed'
          ? statusParam
          : undefined,
      goalAchieved: goalAchievedParam === 'yes' || goalAchievedParam === 'no' ? goalAchievedParam : undefined,
      segmentId: searchParams.get('segmentId') ?? undefined,
    };

    const analytics = computeJourneyAnalytics(journeyId, filters);
    if (!analytics) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const journey = {
      id: analytics.journey.id,
      name: analytics.journey.name,
      status: analytics.journey.status,
    };

    const overview = toJourneyMetrics(analytics);
    const nodePerformance = toNodePerformance(analytics);
    const messagePerformance = toMessagePerformance(analytics);
    const funnel = toGoalFunnel(analytics);
    const experiments = toExperimentResults(analytics);
    const audience = toAudienceBreakdown(analytics);
    const users = toJourneyUsers(analytics);

    return NextResponse.json({
      journey,
      filters,
      overview,
      timeline: analytics.timeline,
      nodePerformance,
      messagePerformance,
      funnel,
      experiments,
      paths: analytics.paths,
      audience,
      users,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


