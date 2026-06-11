export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { getJourneyById, updateJourney } from '@/lib/journey-engine/storage';
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
    const { id } = await params;
    const source = await getJourneyById(id);
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

    await updateJourney(clone);

    return NextResponse.json({ journeyId: cloneId, journey: clone });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


