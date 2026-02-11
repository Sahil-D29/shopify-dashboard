export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneys, saveJourneys } from '@/lib/journey-engine/storage';
import { validateJourney } from '@/lib/journey-engine/validation';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = (await params);
    const body = await request.json().catch(() => ({}));
    const status = body?.status as 'ACTIVE' | 'PAUSED' | undefined;

    if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Use ACTIVE or PAUSED.' }, { status: 400 });
    }

    const journeys = getJourneys();
    const idx = journeys.findIndex(journey => journey.id === resolved.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const journey = journeys[idx];

    if (status === 'ACTIVE') {
      const validation = validateJourney(journey);
      if (validation.errors.length > 0) {
        return NextResponse.json(
          {
            error: 'Journey validation failed. Resolve blockers before activation.',
            validation,
          },
          { status: 400 }
        );
      }

      journeys[idx] = {
        ...journeys[idx],
        status: 'ACTIVE',
        updatedAt: Date.now(),
      };
      saveJourneys(journeys);

      return NextResponse.json({
        journey: journeys[idx],
        validation,
      });
    }

    // Pause flow (no validation required)
    journeys[idx] = {
      ...journeys[idx],
      status: 'PAUSED',
      updatedAt: Date.now(),
    };
    saveJourneys(journeys);

    return NextResponse.json({ journey: journeys[idx] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update journey status';
    console.error('[journey][activate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
