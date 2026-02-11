export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';

interface SendTextRequestBody {
  phoneNumber?: string | number;
  message?: string;
}

interface WhatsAppApiError {
  message?: string;
  code?: number;
  type?: string;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id?: string }>;
  error?: WhatsAppApiError;
}

function formatPhoneNumber(input: string | number): string {
  return String(input).replace(/[\s\-+()]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendTextRequestBody;
    const { phoneNumber, message } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'WhatsApp credentials not configured',
          details: validation.error,
          missing: validation.missing,
        },
        { status: 500 },
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Send a text message (note: this only works in a 24-hour session window)
    const messagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${validation.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validation.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      },
    );

    const result = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: result.error?.message ?? 'Failed to send message',
          details: result.error,
          hint: 'Text messages can only be sent within 24 hours of customer contact. Use templates for cold outreach.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messages?.[0]?.id,
      message: 'Text message sent successfully!',
      phoneNumber: formattedPhone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

