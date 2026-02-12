export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[\s\-]+/g, '_')
    .replace(/^_/, '')
    .replace(/_+/g, '_')
    .toLowerCase()
    .trim();
}

const VALID_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'];

// GET /api/contacts/custom-fields - List custom field definitions for store
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

    const fields = await prisma.customFieldDefinition.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('[Custom Fields GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch custom fields' },
      { status: 500 }
    );
  }
}

// POST /api/contacts/custom-fields - Create custom field definition
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
    const {
      fieldName: rawFieldName,
      fieldLabel,
      fieldType,
      options,
      isRequired,
      isFilterable,
      isTemplateVariable,
    } = body as {
      fieldName?: string;
      fieldLabel: string;
      fieldType: string;
      options?: string[];
      isRequired?: boolean;
      isFilterable?: boolean;
      isTemplateVariable?: boolean;
    };

    if (!fieldLabel || typeof fieldLabel !== 'string' || !fieldLabel.trim()) {
      return NextResponse.json({ error: 'fieldLabel is required' }, { status: 400 });
    }

    if (!fieldType || !VALID_FIELD_TYPES.includes(fieldType)) {
      return NextResponse.json(
        { error: `fieldType must be one of: ${VALID_FIELD_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (fieldType === 'SELECT' && (!options || !Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: 'options array is required for SELECT field type' },
        { status: 400 }
      );
    }

    // Auto-convert fieldLabel to snake_case if fieldName not provided
    const fieldName = rawFieldName ? rawFieldName.trim() : toSnakeCase(fieldLabel);

    // Validate snake_case format
    if (!/^[a-z][a-z0-9_]*$/.test(fieldName)) {
      return NextResponse.json(
        { error: 'fieldName must be snake_case (lowercase letters, numbers, underscores, starting with a letter)' },
        { status: 400 }
      );
    }

    // Check for duplicate fieldName within store
    const existing = await prisma.customFieldDefinition.findUnique({
      where: { storeId_fieldName: { storeId, fieldName } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A custom field with this name already exists' },
        { status: 409 }
      );
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        storeId,
        fieldName,
        fieldLabel: fieldLabel.trim(),
        fieldType: fieldType as any,
        options: options || [],
        isRequired: isRequired ?? false,
        isFilterable: isFilterable ?? true,
        isTemplateVariable: isTemplateVariable ?? false,
      },
    });

    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    console.error('[Custom Fields POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create custom field' },
      { status: 500 }
    );
  }
}
