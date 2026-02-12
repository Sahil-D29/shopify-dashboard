export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

// GET /api/contacts/groups/[id] - Get single group with contact count
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

    const group = await prisma.contactGroup.findFirst({
      where: { id, storeId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Contact group not found' }, { status: 404 });
    }

    const contactIds = Array.isArray(group.contactIds) ? (group.contactIds as string[]) : [];

    return NextResponse.json({
      group: {
        ...group,
        contactCount: contactIds.length,
      },
    });
  } catch (error) {
    console.error('[Contact Group GET by ID] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contact group' },
      { status: 500 }
    );
  }
}

// PUT /api/contacts/groups/[id] - Update group
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

    const existing = await prisma.contactGroup.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact group not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      // Check unique constraint if name is changing
      if (trimmedName !== existing.name) {
        const duplicate = await prisma.contactGroup.findUnique({
          where: { storeId_name: { storeId, name: trimmedName } },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: 'A group with this name already exists' },
            { status: 409 }
          );
        }
      }
      updates.name = trimmedName;
    }

    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;
    if (body.contactIds !== undefined) updates.contactIds = body.contactIds;

    const group = await prisma.contactGroup.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ group, success: true });
  } catch (error) {
    console.error('[Contact Group PUT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact group' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/groups/[id] - Delete group
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

    const existing = await prisma.contactGroup.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact group not found' }, { status: 404 });
    }

    await prisma.contactGroup.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contact Group DELETE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete contact group' },
      { status: 500 }
    );
  }
}
