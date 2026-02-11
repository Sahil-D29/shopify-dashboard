export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { restoreJourneyVersion } from '@/lib/journey-engine/versioning';

export const runtime = 'nodejs';

const resolveParams = async (
  params: { id: string; versionId: string } | Promise<{ id: string; versionId: string }>,
): Promise<{ id: string; versionId: string }> => (params instanceof Promise ? params : Promise.resolve(params));

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const resolved = await params;
    const journey = restoreJourneyVersion(resolved.id, resolved.versionId);
    return NextResponse.json({ journey });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to restore version' }, { status: 400 });
  }
}

