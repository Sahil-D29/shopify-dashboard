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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    // Extract and validate API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Bearer sk_live_...' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const token = authHeader.substring(7);
    const auth = await validateApiKey(token);
    if (!auth) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();

    // Validate payload
    const errors = validateEventPayload(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate event definition exists for this store
    const eventExists = await validateEventDefinitionExists(auth.storeId, body.eventName);
    if (!eventExists) {
      return NextResponse.json(
        { error: `Event '${body.eventName}' is not defined for this store. Create it in Settings > Custom Events first.` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Process the event
    const eventId = await processCustomEvent({
      storeId: auth.storeId,
      eventName: body.eventName,
      customerId: body.customerId,
      email: body.email,
      phone: body.phone,
      sessionId: body.sessionId,
      properties: body.properties || {},
    });

    return NextResponse.json(
      { success: true, eventId },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[CustomEvent API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
