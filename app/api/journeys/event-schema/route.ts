import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getJourneyEventSchema } from '@/lib/journeys/event-schema';

export const dynamic = 'force-dynamic';

/** Authenticated schema lookup used by journey trigger and parameter editors. */
export async function GET(request: NextRequest) {
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
  const eventName = request.nextUrl.searchParams.get('event');
  const schema = getJourneyEventSchema(eventName);
  if (!schema) return NextResponse.json({ error: 'Event schema not found' }, { status: 404 });
  return NextResponse.json({ schema, storeId });
}
