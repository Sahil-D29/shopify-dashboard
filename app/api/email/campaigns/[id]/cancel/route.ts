export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (!storeFilter.allowAll && campaign.storeId !== storeFilter.storeId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (campaign.status !== 'SCHEDULED' && campaign.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot cancel a campaign in ${campaign.status} status` },
        { status: 400 },
      );
    }

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    console.error('[Email Campaigns][CANCEL] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
