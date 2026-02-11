export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

// Ensure this route runs on Node.js runtime (not edge)
export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: campaignId } = await params;

    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const index = campaigns.findIndex(campaign => campaign.id === campaignId);

    if (index === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[index];

    if (campaign.status !== 'PAUSED') {
      return NextResponse.json(
        {
          error: `Campaign cannot be resumed. Current status: ${campaign.status}`,
          currentStatus: campaign.status,
        },
        { status: 400 },
      );
    }

    campaigns[index] = {
      ...campaign,
      status: 'RUNNING',
      updatedAt: Date.now(),
    };

    writeJsonFile('campaigns.json', campaigns);

    return NextResponse.json({
      campaign: campaigns[index],
      success: true,
      message: 'Campaign resumed successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to resume campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

