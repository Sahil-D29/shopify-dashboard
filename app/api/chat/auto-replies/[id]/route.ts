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

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Auto-reply rule not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      keywords,
      matchType,
      replyType,
      replyContent,
      templateName,
      templateData,
      schedule,
      priority,
      isActive,
    } = body;

    const updated = await prisma.autoReplyRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(keywords !== undefined && { keywords }),
        ...(matchType !== undefined && { matchType }),
        ...(replyType !== undefined && { replyType }),
        ...(replyContent !== undefined && { replyContent }),
        ...(templateName !== undefined && { templateName }),
        ...(templateData !== undefined && { templateData }),
        ...(schedule !== undefined && { schedule }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'An auto-reply rule with this name already exists' },
        { status: 409 }
      );
    }
    console.error('[AutoReplies PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update auto-reply rule' }, { status: 500 });
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

    const existing = await prisma.autoReplyRule.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Auto-reply rule not found' }, { status: 404 });
    }

    await prisma.autoReplyRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AutoReplies DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete auto-reply rule' }, { status: 500 });
  }
}
