import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  params instanceof Promise ? params : Promise.resolve(params);

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await resolveParams(params);
    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const campaign = campaigns.find(current => current.id === id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await resolveParams(params);
    const updates = (await request.json()) as Partial<Campaign>;
    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const index = campaigns.findIndex(campaign => campaign.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    campaigns[index] = {
      ...campaigns[index],
      ...updates,
      updatedAt: Date.now(),
    };

    writeJsonFile('campaigns.json', campaigns);

    return NextResponse.json({ campaign: campaigns[index], success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to update campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await resolveParams(params);
    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const filtered = campaigns.filter(campaign => campaign.id !== id);

    if (filtered.length === campaigns.length) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    writeJsonFile('campaigns.json', filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to delete campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

