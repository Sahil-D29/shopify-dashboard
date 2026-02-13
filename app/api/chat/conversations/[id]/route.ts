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

  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, storeId },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            tags: true,
            email: true,
            optInStatus: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PUT(
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

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, assignedTo } = body;

    // Verify conversation belongs to this store
    const existing = await prisma.conversation.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'CLOSED') {
        updateData.closedAt = new Date();
      }
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            tags: true,
            email: true,
            optInStatus: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
