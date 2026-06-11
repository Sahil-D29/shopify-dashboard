export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneyById, updateJourney } from '@/lib/journey-engine/storage';
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

    const journey = await getJourneyById(resolved.id);
    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    if (status === 'ACTIVE') {
      const validation = await validateJourney(journey, journey.storeId);
      if (validation.errors.length > 0) {
        return NextResponse.json(
          {
            error: 'Journey validation failed. Resolve blockers before activation.',
            validation,
          },
          { status: 400 }
        );
      }

      const updated = { ...journey, status: 'ACTIVE' as const, updatedAt: Date.now() };
      await updateJourney(updated);

      return NextResponse.json({ journey: updated, validation });
    }

    // Pause flow (no validation required)
    const paused = { ...journey, status: 'PAUSED' as const, updatedAt: Date.now() };
    await updateJourney(paused);

    return NextResponse.json({ journey: paused });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update journey status';
    console.error('[journey][activate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
