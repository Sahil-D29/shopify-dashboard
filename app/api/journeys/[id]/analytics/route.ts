export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import {
  computeJourneyAnalytics,
  toJourneyMetrics,
  toNodePerformance,
  toGoalFunnel,
  toExperimentResults,
  toAudienceBreakdown,
  toJourneyUsers,
  type AnalyticsFilters,
} from '@/lib/journey-engine/analytics';
import { computeOperationalMetrics } from '@/lib/journey-engine/operational-analytics';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: journeyId } = await params;
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownedJourney = await prisma.journeyDoc.findFirst({ where: { id: journeyId, storeId }, select: { id: true } });
    if (!ownedJourney) return NextResponse.json({ error: 'Journey not found' }, { status: 404 });

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
        statusParam === 'failed' ||
        statusParam === 'suppressed'
          ? statusParam
          : undefined,
      goalAchieved: goalAchievedParam === 'yes' || goalAchievedParam === 'no' ? goalAchievedParam : undefined,
      segmentId: searchParams.get('segmentId') ?? undefined,
    };

    const [analytics, metrics] = await Promise.all([
      computeJourneyAnalytics(journeyId, filters),
      computeOperationalMetrics(storeId, journeyId),
    ]);
    if (!analytics || !metrics) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const journey = {
      id: analytics.journey.id,
      name: analytics.journey.name,
      status: analytics.journey.status,
    };

    const overview = toJourneyMetrics(analytics);
    const nodePerformance = toNodePerformance(analytics);
    const messagePerformance = [{
      channel: 'whatsapp',
      sent: metrics.messages.sent,
      delivered: metrics.messages.delivered,
      opened: metrics.messages.read,
      clicked: metrics.messages.clicked,
      replied: 0,
      deliveryRate: metrics.messages.deliveryRate,
      openRate: metrics.messages.readRate,
      clickRate: metrics.messages.clickRate,
      replyRate: 0,
    }];
    const funnel = toGoalFunnel(analytics);
    const experiments = toExperimentResults(analytics);
    const audience = toAudienceBreakdown(analytics);
    const users = toJourneyUsers(analytics);

    return NextResponse.json({
      journey,
      filters,
      metrics,
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


