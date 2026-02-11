import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

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
    const source = journeys.find(journey => journey.id === id);
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


