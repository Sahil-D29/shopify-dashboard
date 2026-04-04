export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { validateEventPayload, validateEventDefinitionExists } from '@/lib/custom-events/validation';
import { processCustomEvent } from '@/lib/custom-events/processor';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_BATCH_SIZE = 100;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const auth = await validateApiKey(authHeader.substring(7));
    if (!auth) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json(
        { error: 'events must be a non-empty array' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (body.events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} events per batch` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let processed = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < body.events.length; i++) {
      const event = body.events[i];
      try {
        const validationErrors = validateEventPayload(event);
        if (validationErrors.length > 0) {
          failed++;
          errors.push({ index: i, error: validationErrors[0].message });
          continue;
        }

        const exists = await validateEventDefinitionExists(auth.storeId, event.eventName);
        if (!exists) {
          failed++;
          errors.push({ index: i, error: `Event '${event.eventName}' not defined` });
          continue;
        }

        await processCustomEvent({
          storeId: auth.storeId,
          eventName: event.eventName,
          customerId: event.customerId,
          email: event.email,
          phone: event.phone,
          sessionId: event.sessionId,
          properties: event.properties || {},
        });

        processed++;
      } catch {
        failed++;
        errors.push({ index: i, error: 'Processing failed' });
      }
    }

    return NextResponse.json(
      { success: true, processed, failed, errors: errors.length > 0 ? errors : undefined },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[CustomEvent Batch API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
