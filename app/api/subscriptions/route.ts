import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const stores = await prisma.store.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return NextResponse.json([]);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { storeId: { in: storeIds } },
      include: { payments: { take: 10, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
