import { NextRequest, NextResponse } from 'next/server';

import { getJourneyVersion } from '@/lib/journey-engine/versioning';

export const runtime = 'nodejs';

const resolveParams = async (
  params: { id: string; versionId: string } | Promise<{ id: string; versionId: string }>,
): Promise<{ id: string; versionId: string }> => (params instanceof Promise ? params : Promise.resolve(params));

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const resolved = await params;
    const version = getJourneyVersion(resolved.id, resolved.versionId);
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ version });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

