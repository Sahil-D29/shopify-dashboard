export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import { isValidPhone, normalizePhone } from '@/lib/whatsapp/normalize-phone';

interface SendTextRequestBody {
  phoneNumber?: string | number;
  message?: string;
}

function buildUserMessage(error: string | undefined): string {
  const raw = error || 'Failed to send message';
  if (/133010|not registered/i.test(raw)) {
    return 'Your WhatsApp number is not registered for sending yet. Open Settings > WhatsApp and use Register for sending.';
  }
  if (/24\s*hour|outside.*window|customer service window|re-engagement/i.test(raw)) {
    return 'Plain text test messages work only when this number messaged your WhatsApp in the last 24 hours. Use an approved template for cold outreach.';
  }
  if (/recipient|phone|valid/i.test(raw)) {
    return raw;
  }
  return raw;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendTextRequestBody;
    const { phoneNumber, message } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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
          metadata: { createdFrom: 'whatsapp_test_send' },
        },
        select: { id: true, phone: true },
      });
    }

    const preview = message.trim().substring(0, 100);
    const conversation = await prisma.conversation.upsert({
      where: { storeId_contactId: { storeId, contactId: contact.id } },
      update: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        status: 'OPEN',
      },
      create: {
        storeId,
        contactId: contact.id,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      },
      select: { id: true },
    });

    const result = await sendWhatsAppMessage({
      storeId,
      contactId: contact.id,
      conversationId: conversation.id,
      phone: normalizedPhone,
      type: 'text',
      content: message.trim(),
      sentBy: session?.user?.id ?? null,
    });

    if (!result.success) {
      const userMessage = buildUserMessage(result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error ?? 'Failed to send message',
          userMessage,
          dbMessageId: result.dbMessageId,
          phoneNumber: normalizedPhone,
          hint: 'Plain text sends require a 24-hour customer-service window. Approved templates can start a new conversation.',
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
        'Message accepted by WhatsApp. Delivery/read status updates when Meta sends the webhook receipt.',
      phoneNumber: normalizedPhone,
      displayPhoneNumber: `+${normalizedPhone}`,
      hint: 'Plain text test messages are delivered only if this number messaged your WhatsApp in the last 24 hours.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json({ error: message, userMessage: buildUserMessage(message) }, { status: 500 });
  }
}
