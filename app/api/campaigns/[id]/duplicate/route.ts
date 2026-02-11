import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const generateCampaignId = (): string =>
  `camp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const createDuplicateCampaign = (campaign: Campaign): Campaign => {
  const timestamp = Date.now();
  return {
    ...campaign,
    id: generateCampaignId(),
    name: `${campaign.name} (Copy)`,
    status: 'DRAFT',
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
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: undefined,
    completedAt: undefined,
  };
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const original = campaigns.find(campaign => campaign.id === id);

    if (!original) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const duplicate = createDuplicateCampaign(original);
    campaigns.push(duplicate);
    writeJsonFile('campaigns.json', campaigns);

    return NextResponse.json({ campaign: duplicate, success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to duplicate campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

