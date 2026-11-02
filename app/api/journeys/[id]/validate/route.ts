import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneyById } from '@/lib/journey-engine/storage';
import { validateJourney } from '@/lib/journey-engine/validation';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const resolved = await params;
    const journey = await getJourneyById(resolved.id);

    if (!journey || journey.storeId !== storeId) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const validation = await validateJourney(journey, journey.storeId);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('[journey][validate]', error);
    return NextResponse.json({ error: getErrorMessage(error) ?? 'Failed to validate journey' }, { status: 500 });
  }
}

