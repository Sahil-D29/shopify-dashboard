import { NextRequest, NextResponse } from 'next/server';

import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyDefinition } from '@/lib/types/journey';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    const idx = journeys.findIndex(j => j.id === params.id);
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

