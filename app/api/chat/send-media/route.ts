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
    const { conversationId, mediaUrl, mediaType, caption, type } = body;

    if (!conversationId || !mediaUrl || !type) {
      return NextResponse.json(
        { error: 'conversationId, mediaUrl, and type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['image', 'video', 'document', 'audio'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the conversation and verify store ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (!conversation.contact) {
      return NextResponse.json({ error: 'Contact not found for conversation' }, { status: 404 });
    }

    // Send the media message
    const result = await sendWhatsAppMessage({
      storeId,
      contactId: conversation.contactId,
      conversationId: conversation.id,
      phone: conversation.contact.phone,
      type,
      mediaUrl,
      mediaType: mediaType || type,
      caption: caption || undefined,
      sentBy: userContext.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[SendMedia POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send media message' }, { status: 500 });
  }
}
