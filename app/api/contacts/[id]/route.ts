export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

// GET /api/contacts/[id] - Get single contact by ID
export async function GET(
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

    const contact = await prisma.contact.findFirst({
      where: { id, storeId },
      include: {
        conversations: {
          select: { id: true },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const result = {
      ...contact,
      conversationsCount: contact.conversations.length,
      conversations: undefined,
    };

    return NextResponse.json({ contact: result });
  } catch (error) {
    console.error('[Contacts GET by ID] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

// PUT /api/contacts/[id] - Update contact
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

    const existing = await prisma.contact.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.firstName !== undefined) updates.firstName = body.firstName;
    if (body.lastName !== undefined) updates.lastName = body.lastName;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.optInStatus !== undefined) {
      updates.optInStatus = body.optInStatus;
      if (body.optInStatus === 'OPTED_IN') updates.optInAt = new Date();
      if (body.optInStatus === 'OPTED_OUT') updates.optOutAt = new Date();
    }
    if (body.customFields !== undefined) updates.customFields = body.customFields;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const contact = await prisma.contact.update({
      where: { id },
      data: updates as any,
    });

    return NextResponse.json({ contact, success: true });
  } catch (error) {
    console.error('[Contacts PUT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id] - Delete contact
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

    const existing = await prisma.contact.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.contact.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contacts DELETE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
