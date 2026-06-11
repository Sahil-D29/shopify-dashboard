export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getJourneyById, updateJourney } from '@/lib/journey-engine/storage';

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
    const journey = await getJourneyById(id);
    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const updated = {
      ...journey,
      status: 'PAUSED' as const,
      updatedAt: new Date().toISOString(),
    };

    await updateJourney(updated);

    return NextResponse.json({ journey: updated });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

