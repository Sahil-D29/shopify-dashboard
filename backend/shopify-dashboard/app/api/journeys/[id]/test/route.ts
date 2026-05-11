import { NextRequest, NextResponse } from 'next/server';

import { runJourneyTest } from '@/lib/journey-engine';

export const runtime = 'nodejs';

interface JourneyTestPayload {
  phoneNumbers?: string[];
  customerIds?: string[];
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json().catch(() => ({}))) as JourneyTestPayload;
    const phoneNumbers = Array.isArray(body.phoneNumbers) ? body.phoneNumbers : [];
    const customerIds = Array.isArray(body.customerIds) ? body.customerIds : [];

    const result = await runJourneyTest(params.id, { phoneNumbers, customerIds });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}


