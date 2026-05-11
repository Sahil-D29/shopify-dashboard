export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface VariantStats {
  variant: 'A' | 'B';
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export interface AbTestSummary {
  id: string;
  name: string;
  status: string;
  completedAt: string | null;
  scheduledAt: string | null;
  abTestPercent: number;
  abTestWinnerMetric: 'OPEN_RATE' | 'CLICK_RATE';
  variants: VariantStats[];
  winner: 'A' | 'B' | null;
  winnerByMetric: number; // delta percentage points (winner - loser)
}

function buildVariantStats(
  variant: 'A' | 'B',
  subject: string,
  sends: Array<{ status: string }>,
): VariantStats {
  const sent = sends.length;
  const opened = sends.filter(s =>
    ['OPENED', 'CLICKED'].includes(s.status),
  ).length;
  const clicked = sends.filter(s => s.status === 'CLICKED').length;
  const bounced = sends.filter(s => s.status === 'BOUNCED').length;
  return {
    variant,
    subject,
    sent,
    opened,
    clicked,
    bounced,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', tests: [] },
        { status: 401 },
      );
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const where: any = storeFilter.allowAll
      ? { abTestEnabled: true }
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId, abTestEnabled: true }
        : { storeId: '__none__' };

    const campaigns = await prisma.emailCampaign.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // SENDING/COMPLETED first
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        status: true,
        completedAt: true,
        scheduledAt: true,
        subject: true,
        abTestPercent: true,
        abTestVariantSubject: true,
        abTestWinnerMetric: true,
      },
    });

    if (campaigns.length === 0) {
      return NextResponse.json({ success: true, tests: [] });
    }

    // For each test, group sends by variant
    const campaignIds = campaigns.map(c => c.id);
    const sends = await prisma.emailCampaignSend.findMany({
      where: { campaignId: { in: campaignIds } },
      select: { campaignId: true, variant: true, status: true },
    });

    const sendsByCampaign = new Map<string, typeof sends>();
    for (const s of sends) {
      const arr = sendsByCampaign.get(s.campaignId) ?? [];
      arr.push(s);
      sendsByCampaign.set(s.campaignId, arr);
    }

    const tests: AbTestSummary[] = campaigns.map(c => {
      const all = sendsByCampaign.get(c.id) ?? [];
      const variantA = buildVariantStats(
        'A',
        c.subject,
        all.filter(s => s.variant === 'A'),
      );
      const variantB = buildVariantStats(
        'B',
        c.abTestVariantSubject ?? '(no variant B)',
        all.filter(s => s.variant === 'B'),
      );

      let winner: 'A' | 'B' | null = null;
      let winnerByMetric = 0;
      if (variantA.sent > 0 && variantB.sent > 0) {
        const aMetric =
          c.abTestWinnerMetric === 'CLICK_RATE' ? variantA.clickRate : variantA.openRate;
        const bMetric =
          c.abTestWinnerMetric === 'CLICK_RATE' ? variantB.clickRate : variantB.openRate;
        if (aMetric > bMetric) {
          winner = 'A';
          winnerByMetric = aMetric - bMetric;
        } else if (bMetric > aMetric) {
          winner = 'B';
          winnerByMetric = bMetric - aMetric;
        }
      }

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        completedAt: c.completedAt ? c.completedAt.toISOString() : null,
        scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
        abTestPercent: c.abTestPercent,
        abTestWinnerMetric: c.abTestWinnerMetric as 'OPEN_RATE' | 'CLICK_RATE',
        variants: [variantA, variantB],
        winner,
        winnerByMetric,
      };
    });

    return NextResponse.json({ success: true, tests });
  } catch (error) {
    console.error('[A/B Tests][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load A/B tests',
        details: getErrorMessage(error),
        tests: [],
      },
      { status: 200 },
    );
  }
}
