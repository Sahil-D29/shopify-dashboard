export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

// GET /api/contacts/groups - List all contact groups for store
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

    const groups = await prisma.contactGroup.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with contact count
    const enrichedGroups = groups.map(group => {
      const contactIds = Array.isArray(group.contactIds) ? (group.contactIds as string[]) : [];
      return {
        ...group,
        contactCount: contactIds.length,
      };
    });

    return NextResponse.json({ groups: enrichedGroups });
  } catch (error) {
    console.error('[Contact Groups GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contact groups' },
      { status: 500 }
    );
  }
}

// POST /api/contacts/groups - Create a new contact group
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
    const { name, description, color, contactIds } = body as {
      name: string;
      description?: string;
      color?: string;
      contactIds?: string[];
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Check for duplicate name within store
    const existing = await prisma.contactGroup.findUnique({
      where: { storeId_name: { storeId, name: name.trim() } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A group with this name already exists' },
        { status: 409 }
      );
    }

    const group = await prisma.contactGroup.create({
      data: {
        storeId,
        name: name.trim(),
        description: description || null,
        color: color || null,
        contactIds: contactIds || [],
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('[Contact Groups POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact group' },
      { status: 500 }
    );
  }
}
