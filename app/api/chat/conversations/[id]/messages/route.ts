export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storeId = await getCurrentStoreId(request);
  if (!storeId) {
    return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
  }

  const { id: conversationId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const before = searchParams.get('before'); // cursor: message ID

  try {
    // Verify conversation belongs to this store
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const where: any = { conversationId, storeId };

    if (before) {
      where.createdAt = {
        lt: (
          await prisma.message.findUnique({
            where: { id: before },
            select: { createdAt: true },
          })
        )?.createdAt,
      };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    return NextResponse.json({
      messages,
      pagination: {
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storeId = await getCurrentStoreId(request);
  if (!storeId) {
    return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
  }

  const { id: conversationId } = await params;

  try {
    const body = await request.json();
    const {
      content,
      type = 'TEXT',
      mediaUrl,
      mediaType,
      templateName,
      templateLanguage,
      templateComponents,
    } = body;

    // Verify conversation belongs to this store and get contact info
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
      include: {
        contact: {
          select: { id: true, phone: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const result = await sendWhatsAppMessage({
      storeId,
      contactId: conversation.contactId,
      conversationId,
      phone: conversation.contact.phone,
      type,
      content,
      templateName,
      templateLanguage,
      templateComponents,
      mediaUrl,
      mediaType,
      sentBy: userContext.userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send message' }, { status: 500 });
    }

    // Reset unread count on the conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    return NextResponse.json({
      success: true,
      whatsappMessageId: result.whatsappMessageId,
      dbMessageId: result.dbMessageId,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
