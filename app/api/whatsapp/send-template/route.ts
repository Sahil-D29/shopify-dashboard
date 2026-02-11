export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import type {
  WhatsAppTemplateBodyParameter,
  WhatsAppTemplateComponent,
} from '@/lib/types/whatsapp-config';

interface SendTemplateRequestBody {
  templateName?: string;
  phoneNumber?: string | number;
  variables?: Record<string, string | number | boolean | null | undefined>;
  language?: string;
}

interface WhatsAppApiError {
  message?: string;
  code?: number;
  type?: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id?: string }>;
  error?: WhatsAppApiError;
}

interface TemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: WhatsAppTemplateComponent[];
  };
}

function buildComponents(
  variables: SendTemplateRequestBody['variables'],
): WhatsAppTemplateComponent[] | undefined {
  if (!variables) return undefined;
  const entries = Object.entries(variables);
  if (entries.length === 0) return undefined;
  const parameters: WhatsAppTemplateBodyParameter[] = entries.map(([, value]) => ({
    type: 'text',
    text: String(value ?? ''),
  }));
  return [{ type: 'body', parameters }];
}

function formatPhoneNumber(input: string | number): string {
  const formatted = String(input).replace(/[\s\-+()]/g, '');
  return formatted;
}

function buildUserFriendlyMessage(error: WhatsAppApiError | undefined, fallback: string): string {
  if (!error) return fallback;
  const code = error.code;
  if (code === 131047) return 'Template not approved yet. Use an approved template.';
  if (code === 131026) return 'Invalid phone number format.';
  if (code === 133016) return 'This phone number is not registered on WhatsApp.';
  if (code === 100) return 'Invalid parameter. Check template variables.';
  if (code === 190) return 'Access token expired. Update WhatsApp credentials.';
  if (error.message && error.message.includes('template') && error.message.includes('not found')) {
    return 'Template not found. Make sure the template is approved.';
  }
  return error.message ?? fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendTemplateRequestBody;
    const { templateName, phoneNumber, variables, language } = body;

    if (!templateName) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }

    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'WhatsApp credentials not configured in server environment. Please check .env.local file',
          details: validation.error,
          missing: validation.missing,
          hint: 'Ensure .env.local exists at project root and restart the dev server',
        },
        { status: 500 },
      );
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (formattedPhone.startsWith('0')) {
      return NextResponse.json(
        {
          error: 'Invalid phone number format. Please include country code (e.g., 919876543210)',
          hint: 'Remove leading 0 and add country code',
        },
        { status: 400 },
      );
    }

    const components = buildComponents(variables);

    const messagePayload: TemplatePayload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
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
      const errorMessage = result.error?.message ?? 'Failed to send message';
      const userFriendlyMessage = buildUserFriendlyMessage(result.error, errorMessage);

      return NextResponse.json(
        {
          error: errorMessage,
          userMessage: userFriendlyMessage,
          details: result.error,
          errorCode: result.error?.code,
          payload: messagePayload,
        },
        { status: response.status },
      );
    }

    const messageId = result.messages?.[0]?.id;

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Message sent successfully!',
      wabaMessageId: messageId,
      phoneNumber: formattedPhone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.stack : String(error),
        hint: 'Check server console logs for detailed error information',
      },
      { status: 500 },
    );
  }
}

