export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneyById } from '@/lib/journey-engine/storage';
import { validateJourney } from '@/lib/journey-engine/validation';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params;
    const journey = getJourneyById(resolved.id);

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const validation = validateJourney(journey);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('[journey][validate]', error);
    return NextResponse.json({ error: getErrorMessage(error) ?? 'Failed to validate journey' }, { status: 500 });
  }
}

