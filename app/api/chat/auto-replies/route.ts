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

    const rules = await prisma.autoReplyRule.findMany({
      where: { storeId },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('[AutoReplies GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch auto-reply rules' }, { status: 500 });
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
    const {
      name,
      keywords,
      matchType = 'contains',
      replyType = 'text',
      replyContent,
      templateName,
      templateData,
      schedule,
      priority = 0,
      isActive = true,
    } = body;

    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'name and keywords (non-empty array) are required' },
        { status: 400 }
      );
    }

    const rule = await prisma.autoReplyRule.create({
      data: {
        storeId,
        name,
        keywords,
        matchType,
        replyType,
        replyContent: replyContent || null,
        templateName: templateName || null,
        templateData: templateData || undefined,
        schedule: schedule || undefined,
        priority,
        isActive,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'An auto-reply rule with this name already exists' },
        { status: 409 }
      );
    }
    console.error('[AutoReplies POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create auto-reply rule' }, { status: 500 });
  }
}
