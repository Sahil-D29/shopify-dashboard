import { NextRequest, NextResponse } from 'next/server';

import { exitJourney, getEnrollment } from '@/lib/journey-engine/executor';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await params;
    const enrollment = getEnrollment(resolved.id);
    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    await exitJourney(enrollment, 'manual');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Failed to cancel enrollment' },
      { status: 500 },
    );
  }
}

