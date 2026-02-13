export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

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

  try {
    // Verify conversation belongs to this store
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const notes = await prisma.internalNote.findMany({
      where: { conversationId, storeId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
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
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Verify conversation belongs to this store and get contactId
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const note = await prisma.internalNote.create({
      data: {
        conversationId,
        contactId: conversation.contactId,
        storeId,
        content: content.trim(),
        createdBy: userContext.userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
