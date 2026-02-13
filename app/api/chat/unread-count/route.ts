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

    const result = await prisma.conversation.aggregate({
      where: {
        storeId,
        status: { in: ['OPEN', 'PENDING'] },
      },
      _sum: {
        unreadCount: true,
      },
    });

    const totalUnread = result._sum.unreadCount || 0;

    return NextResponse.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error('[UnreadCount GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
  }
}
