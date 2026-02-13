export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const { id } = await params;

    const existing = await prisma.quickReply.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 });
    }

    const body = await request.json();
    const { shortcut, title, content, category } = body;

    if (shortcut && !shortcut.startsWith('/')) {
      return NextResponse.json(
        { error: 'Shortcut must start with "/"' },
        { status: 400 }
      );
    }

    const updated = await prisma.quickReply.update({
      where: { id },
      data: {
        ...(shortcut !== undefined && { shortcut }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A quick reply with this shortcut already exists' },
        { status: 409 }
      );
    }
    console.error('[QuickReplies PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update quick reply' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const { id } = await params;

    const existing = await prisma.quickReply.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Quick reply not found' }, { status: 404 });
    }

    await prisma.quickReply.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[QuickReplies DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete quick reply' }, { status: 500 });
  }
}
