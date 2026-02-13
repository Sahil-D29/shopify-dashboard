export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { contactId, templateName, templateLanguage, templateComponents } = body;

    if (!contactId || !templateName) {
      return NextResponse.json(
        { error: 'contactId and templateName are required' },
        { status: 400 }
      );
    }

    // Get the contact
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, storeId },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find or create conversation for this contact
    let conversation = await prisma.conversation.findFirst({
      where: { contactId, storeId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          storeId,
          contactId,
          status: 'OPEN',
        },
      });
    }

    // Send the template message
    const result = await sendWhatsAppMessage({
      storeId,
      contactId,
      conversationId: conversation.id,
      phone: contact.phone,
      type: 'template',
      templateName,
      templateLanguage: templateLanguage || 'en',
      templateComponents: templateComponents || [],
      sentBy: userContext.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[SendTemplate POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send template message' }, { status: 500 });
  }
}
