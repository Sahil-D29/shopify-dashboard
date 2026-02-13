export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const quickReplies = await prisma.quickReply.findMany({
      where: { storeId },
      orderBy: { shortcut: 'asc' },
    });

    return NextResponse.json(quickReplies);
  } catch (error) {
    console.error('[QuickReplies GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch quick replies' }, { status: 500 });
  }
}

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
    const { shortcut, title, content, category } = body;

    if (!shortcut || !title || !content) {
      return NextResponse.json(
        { error: 'shortcut, title, and content are required' },
        { status: 400 }
      );
    }

    if (!shortcut.startsWith('/')) {
      return NextResponse.json(
        { error: 'Shortcut must start with "/"' },
        { status: 400 }
      );
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        storeId,
        shortcut,
        title,
        content,
        category: category || null,
        createdBy: userContext.userId,
      },
    });

    return NextResponse.json(quickReply, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A quick reply with this shortcut already exists' },
        { status: 409 }
      );
    }
    console.error('[QuickReplies POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create quick reply' }, { status: 500 });
  }
}
