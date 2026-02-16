export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

interface FlowElement { id: string; type: string; label: string; }
interface FlowScreen { id: string; title: string; elements: FlowElement[]; navigation: { type: string; nextScreenId?: string }; }
interface FlowDefinition { screens: FlowScreen[]; }

export async function POST(
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
    });
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    const definition = flow.definition as unknown as FlowDefinition;
    const errors: string[] = [];
    if (!definition?.screens || definition.screens.length === 0) {
      errors.push('Flow must have at least one screen');
    } else {
      for (const screen of definition.screens) {
        if (!screen.title?.trim()) errors.push('Screen "' + screen.id + '" is missing a title');
        if (!screen.elements?.length) errors.push('Screen "' + (screen.title || screen.id) + '" must have at least one element');
        if (screen.navigation?.type === 'next' && screen.navigation.nextScreenId) {
          if (!definition.screens.some(s => s.id === screen.navigation.nextScreenId)) {
            errors.push('Screen "' + screen.title + '" points to non-existent screen');
          }
        }
      }
    }
    if (errors.length > 0) {
      await prisma.whatsAppFlow.update({ where: { id }, data: { validationErrors: errors } });
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }
    const updated = await prisma.whatsAppFlow.update({
      where: { id },
      data: { status: 'PUBLISHED', validationErrors: Prisma.JsonNull },
    });
    return NextResponse.json({ success: true, flow: updated });
  } catch (error) {
    console.error('Publish flow error:', error);
    return NextResponse.json({ error: 'Failed to publish flow' }, { status: 500 });
  }
}
