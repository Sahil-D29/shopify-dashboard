export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyDefinition } from '@/lib/types/journey';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    const { id } = await params;
    const idx = journeys.findIndex(j => j.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    journeys[idx] = {
      ...journeys[idx],
      status: 'PAUSED',
      updatedAt: new Date().toISOString(),
    };

    writeJsonFile('journeys.json', journeys);

    return NextResponse.json({ journey: journeys[idx] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

