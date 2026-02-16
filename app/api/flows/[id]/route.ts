export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const storeId = await getCurrentStoreId(request);
    const flow = await prisma.whatsAppFlow.findFirst({
      where: { id, storeId: storeId || undefined },
      include: { _count: { select: { responses: true } } },
    });
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    return NextResponse.json({ flow });
  } catch (error) {
    console.error('Get flow error:', error);
    return NextResponse.json({ error: 'Failed to fetch flow' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const storeId = await getCurrentStoreId(request);
    const body = await request.json();
    const { name, definition, categories } = body;
    const existing = await prisma.whatsAppFlow.findFirst({
      where: { id, storeId: storeId || undefined },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    const flow = await prisma.whatsAppFlow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(definition !== undefined && { definition }),
        ...(categories !== undefined && { categories }),
      },
    });
    return NextResponse.json({ flow });
  } catch (error) {
    console.error('Update flow error:', error);
    return NextResponse.json({ error: 'Failed to update flow' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const storeId = await getCurrentStoreId(request);
    const existing = await prisma.whatsAppFlow.findFirst({
      where: { id, storeId: storeId || undefined },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    await prisma.whatsAppFlow.update({
      where: { id },
      data: { status: 'DEPRECATED' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete flow error:', error);
    return NextResponse.json({ error: 'Failed to delete flow' }, { status: 500 });
  }
}
