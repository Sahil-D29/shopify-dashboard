import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

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
    const source = journeys.find(journey => journey.id === params.id);
    if (!source) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const now = Date.now();
    const cloneId = uuid();
    const clone: JourneyDefinition = {
      ...source,
      id: cloneId,
      name: `${source.name || 'Journey'} Copy`,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    journeys.push(clone);
    writeJsonFile('journeys.json', journeys);

    return NextResponse.json({ journeyId: cloneId, journey: clone });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


