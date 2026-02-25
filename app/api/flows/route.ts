export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const flows = await prisma.whatsAppFlow.findMany({
      where: {
        storeId,
        ...(status ? { status: status as 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' } : {}),
      },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ flows });
  } catch (error) {
    console.error('List flows error:', error);
    return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const body = await request.json();
    const { name, category } = body;
    if (!name) {
      return NextResponse.json({ error: 'Flow name is required' }, { status: 400 });
    }
    const flow = await prisma.whatsAppFlow.create({
      data: {
        storeId,
        name,
        categories: category ? [category] : [],
        createdBy: session.user.email,
        definition: {
          screens: [{
            id: 'screen_1',
            title: 'Welcome',
            description: '',
            elements: [],
            navigation: { type: 'complete' },
          }],
        },
      },
    });
    return NextResponse.json({ success: true, flow }, { status: 201 });
  } catch (error) {
    console.error('Create flow error:', error);
    return NextResponse.json({ error: 'Failed to create flow' }, { status: 500 });
  }
}
