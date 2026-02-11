import { NextRequest, NextResponse } from 'next/server';

interface TestConnectionRequestBody {
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
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
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseRequestBody(await request.json().catch(() => ({})));
    const { wabaId, phoneNumberId, accessToken } = payload;

    if (!wabaId || !phoneNumberId || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing wabaId, phoneNumberId, or accessToken' },
        { status: 400 },
      );
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
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

