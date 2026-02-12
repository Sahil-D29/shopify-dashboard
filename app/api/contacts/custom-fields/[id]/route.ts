export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

const VALID_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'];

// PUT /api/contacts/custom-fields/[id] - Update custom field definition
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

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.fieldLabel !== undefined) {
      updates.fieldLabel = body.fieldLabel.trim();
    }

    if (body.fieldType !== undefined) {
      if (!VALID_FIELD_TYPES.includes(body.fieldType)) {
        return NextResponse.json(
          { error: `fieldType must be one of: ${VALID_FIELD_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.fieldType = body.fieldType;
    }

    if (body.options !== undefined) {
      updates.options = body.options;
    }

    if (body.isRequired !== undefined) updates.isRequired = body.isRequired;
    if (body.isFilterable !== undefined) updates.isFilterable = body.isFilterable;
    if (body.isTemplateVariable !== undefined) updates.isTemplateVariable = body.isTemplateVariable;

    const field = await prisma.customFieldDefinition.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ field, success: true });
  } catch (error) {
    console.error('[Custom Field PUT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update custom field' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/custom-fields/[id] - Delete custom field definition
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

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Custom field not found' }, { status: 404 });
    }

    await prisma.customFieldDefinition.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Custom Field DELETE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete custom field' },
      { status: 500 }
    );
  }
}
