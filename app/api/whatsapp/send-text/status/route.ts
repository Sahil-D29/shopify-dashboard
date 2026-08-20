export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const messageId = request.nextUrl.searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId, storeId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        whatsappMessageId: true,
        updatedAt: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        status: message.status,
        errorMessage: message.errorMessage,
        whatsappMessageId: message.whatsappMessageId,
        updatedAt: message.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load message status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
