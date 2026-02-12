export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('91') && digits.length >= 12) return '+' + digits;
  if (digits.length === 10) return '+91' + digits;
  return '+' + digits;
}

// POST /api/contacts/import - Import contacts from CSV
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
    const { csvData, columnMapping } = body as {
      csvData: string;
      columnMapping: Record<string, number>;
    };

    if (!csvData || typeof csvData !== 'string') {
      return NextResponse.json({ error: 'csvData is required as a string' }, { status: 400 });
    }

    if (!columnMapping || typeof columnMapping.phone !== 'number') {
      return NextResponse.json(
        { error: 'columnMapping with at least a phone column index is required' },
        { status: 400 }
      );
    }

    const rows = csvData.split('\n').map(row => row.split(','));

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV must contain at least a header row and one data row' }, { status: 400 });
    }

    // Skip header row
    const dataRows = rows.slice(1).filter(row => row.length > 0 && row.some(cell => cell.trim()));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, accounting for header

      try {
        const rawPhone = row[columnMapping.phone]?.trim();
        if (!rawPhone) {
          skipped++;
          errors.push(`Row ${rowNum}: Missing phone number`);
          continue;
        }

        const phone = normalizePhone(rawPhone);

        const name = columnMapping.name !== undefined ? row[columnMapping.name]?.trim() || null : null;
        const email = columnMapping.email !== undefined ? row[columnMapping.email]?.trim() || null : null;
        const firstName = columnMapping.firstName !== undefined ? row[columnMapping.firstName]?.trim() || null : null;
        const lastName = columnMapping.lastName !== undefined ? row[columnMapping.lastName]?.trim() || null : null;
        const tagsRaw = columnMapping.tags !== undefined ? row[columnMapping.tags]?.trim() || '' : '';
        const tags = tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [];

        const contactName = name || (firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : null);

        const result = await prisma.contact.upsert({
          where: { storeId_phone: { storeId, phone } },
          create: {
            storeId,
            phone,
            name: contactName,
            email,
            firstName,
            lastName,
            tags,
            source: 'CSV_IMPORT',
            optInStatus: 'NOT_SET',
            customFields: {},
          },
          update: {
            name: contactName || undefined,
            email: email || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
        });

        // Check if this was a create or update by comparing createdAt and updatedAt
        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) {
          created++;
        } else {
          updated++;
        }
      } catch (rowError) {
        skipped++;
        errors.push(`Row ${rowNum}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      total: dataRows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('[Contacts Import] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import contacts' },
      { status: 500 }
    );
  }
}
