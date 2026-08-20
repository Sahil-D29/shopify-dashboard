export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { isValidPhone, normalizePhone } from '@/lib/whatsapp/normalize-phone';
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

function buildUserFriendlyMessage(error: string | WhatsAppApiError | undefined, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'string') {
    if (/133010|not registered/i.test(error)) {
      return 'Your WhatsApp number is not registered for sending yet. Open Settings > WhatsApp and use Register for sending.';
    }
    if (/template.*approved|not approved|131047/i.test(error)) return 'Template not approved yet. Use an approved template.';
    if (/template.*not found/i.test(error)) return 'Template not found. Make sure the template is approved and synced from Meta.';
    if (/access token|190/i.test(error)) return 'Access token expired. Update WhatsApp credentials.';
    return error;
  }
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

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          error: 'Invalid phone number format',
          userMessage: 'Enter a WhatsApp number with country code. Indian 10-digit numbers are sent as +91 automatically.',
          phoneNumber: normalizedPhone,
        },
        { status: 400 },
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const session = await auth().catch(() => null);
    const possiblePhones = normalizedPhone.startsWith('+')
      ? [normalizedPhone, normalizedPhone.replace(/^\+/, '')]
      : [normalizedPhone, `+${normalizedPhone}`];

    let contact = await prisma.contact.findFirst({
      where: { storeId, phone: { in: possiblePhones } },
      select: { id: true, phone: true },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          storeId,
          phone: normalizedPhone,
          source: 'MANUAL',
          optInStatus: 'NOT_SET',
          lastMessageAt: new Date(),
          tags: [],
          customFields: {},
          metadata: { createdFrom: 'whatsapp_template_test_send' },
        },
        select: { id: true, phone: true },
      });
    }

    const conversation = await prisma.conversation.upsert({
      where: { storeId_contactId: { storeId, contactId: contact.id } },
      update: {
        lastMessageAt: new Date(),
        lastMessagePreview: templateName.substring(0, 100),
        status: 'OPEN',
      },
      create: {
        storeId,
        contactId: contact.id,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessagePreview: templateName.substring(0, 100),
      },
      select: { id: true },
    });

    const components = buildComponents(variables) ?? [];
    const result = await sendWhatsAppMessage({
      storeId,
      contactId: contact.id,
      conversationId: conversation.id,
      phone: normalizedPhone,
      type: 'template',
      templateName,
      templateLanguage: language,
      templateComponents: components,
      sentBy: session?.user?.id ?? null,
    });

    if (!result.success) {
      const userFriendlyMessage = buildUserFriendlyMessage(result.error, 'Failed to send template message');

      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to send template message',
          userMessage: userFriendlyMessage,
          dbMessageId: result.dbMessageId,
          phoneNumber: normalizedPhone,
          hint: 'Only approved WhatsApp templates can start a new conversation outside the 24-hour customer-service window.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.whatsappMessageId,
      whatsappMessageId: result.whatsappMessageId,
      dbMessageId: result.dbMessageId,
      deliveryStatus: result.dbMessageId ? 'SENT' : 'ACCEPTED',
      message:
        'Template accepted by WhatsApp. Delivery/read status updates when Meta sends the webhook receipt.',
      phoneNumber: normalizedPhone,
      displayPhoneNumber: `+${normalizedPhone}`,
      hint: 'Approved templates can start new WhatsApp conversations. Pending or draft templates cannot.',
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

