export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { META_GRAPH_API_VERSION, resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';

interface TestConnectionRequestBody {
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  storeId?: string;
}

interface PhoneNumberInfoResponse {
  display_phone_number?: string;
  verified_name?: string;
  error?: {
    message?: string;
  };
}

function parseRequestBody(body: unknown): TestConnectionRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const payload = body as TestConnectionRequestBody;
  return {
    wabaId: payload.wabaId,
    phoneNumberId: payload.phoneNumberId,
    accessToken: payload.accessToken,
    storeId: payload.storeId,
  };
}

// A masked token from the GET endpoint (e.g. "••••••••abcd1234") is not usable.
function isUsableToken(token?: string): token is string {
  return !!token && !token.includes('•');
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseRequestBody(await request.json().catch(() => ({})));
    let { phoneNumberId, accessToken } = payload;

    // If the client didn't supply usable credentials (e.g. connected via
    // Embedded Signup — token lives encrypted in the DB), fall back to the
    // stored/resolved config for this store.
    if (!phoneNumberId || !isUsableToken(accessToken)) {
      const resolved = await resolveWhatsAppConfig(payload.storeId);
      if (resolved.valid) {
        phoneNumberId = phoneNumberId || resolved.config.phoneNumberId;
        accessToken = resolved.config.accessToken;
      }
    }

    if (!phoneNumberId || !isUsableToken(accessToken)) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp is not configured. Connect with Facebook or enter credentials manually.' },
        { status: 400 },
      );
    }

    const response = await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${phoneNumberId}`, accessToken), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as PhoneNumberInfoResponse;

    if (!response.ok) {
      const errorMessage = data.error?.message ?? 'Invalid credentials';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

