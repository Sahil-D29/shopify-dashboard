export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

// GET /api/contacts/export - Export contacts as CSV
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

    const { searchParams } = new URL(request.url);
    const optInStatus = searchParams.get('optInStatus') || '';
    const source = searchParams.get('source') || '';
    const tag = searchParams.get('tag') || '';

    const where: Record<string, unknown> = { storeId };

    if (optInStatus) {
      where.optInStatus = optInStatus;
    }

    if (source) {
      where.source = source;
    }

    if (tag) {
      where.tags = { array_contains: [tag] };
    }

    const contacts = await prisma.contact.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = ['phone', 'name', 'email', 'firstName', 'lastName', 'tags', 'optInStatus', 'source', 'createdAt'];
    const csvRows = [headers.join(',')];

    for (const contact of contacts) {
      const tags = Array.isArray(contact.tags) ? (contact.tags as string[]).join(';') : '';
      const row = [
        contact.phone || '',
        escapeCsvField(contact.name || ''),
        escapeCsvField(contact.email || ''),
        escapeCsvField(contact.firstName || ''),
        escapeCsvField(contact.lastName || ''),
        escapeCsvField(tags),
        contact.optInStatus || '',
        contact.source || '',
        contact.createdAt ? contact.createdAt.toISOString() : '',
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-export-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Contacts Export] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export contacts' },
      { status: 500 }
    );
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
