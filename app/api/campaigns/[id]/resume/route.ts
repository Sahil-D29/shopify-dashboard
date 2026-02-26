export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { transformCampaign } from '@/lib/utils/db-transformers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const storeId = await getCurrentStoreId(request);

    // Find the campaign
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, storeId: storeId || undefined },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'PAUSED') {
      return NextResponse.json(
        {
          error: `Campaign cannot be resumed. Current status: ${campaign.status}`,
          currentStatus: campaign.status,
        },
        { status: 400 },
      );
    }

    // Update to RUNNING
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
      include: { segment: true, store: true, creator: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      campaign: transformCampaign(updated),
      success: true,
      message: 'Campaign resumed successfully',
    });
  } catch (error) {
    console.error('[API] Error resuming campaign:', error);
    return NextResponse.json(
      { error: 'Failed to resume campaign', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
