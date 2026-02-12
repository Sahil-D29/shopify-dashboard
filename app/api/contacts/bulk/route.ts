export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

type BulkAction = 'tag' | 'untag' | 'delete' | 'opt_out' | 'opt_in';

interface BulkRequestBody {
  action: BulkAction;
  contactIds: string[];
  tag?: string;
}

// POST /api/contacts/bulk - Bulk actions on contacts
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

    const body: BulkRequestBody = await request.json();
    const { action, contactIds, tag } = body;

    if (!action || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'action and contactIds (non-empty array) are required' },
        { status: 400 }
      );
    }

    if ((action === 'tag' || action === 'untag') && !tag) {
      return NextResponse.json(
        { error: 'tag is required for tag/untag actions' },
        { status: 400 }
      );
    }

    // Verify all contacts belong to this store
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        storeId,
      },
      select: { id: true, tags: true },
    });

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No matching contacts found for this store' }, { status: 404 });
    }

    const validIds = contacts.map(c => c.id);
    let updatedCount = 0;

    switch (action) {
      case 'delete': {
        const result = await prisma.contact.deleteMany({
          where: { id: { in: validIds }, storeId },
        });
        updatedCount = result.count;
        break;
      }

      case 'opt_out': {
        const result = await prisma.contact.updateMany({
          where: { id: { in: validIds }, storeId },
          data: {
            optInStatus: 'OPTED_OUT',
            optOutAt: new Date(),
          },
        });
        updatedCount = result.count;
        break;
      }

      case 'opt_in': {
        const result = await prisma.contact.updateMany({
          where: { id: { in: validIds }, storeId },
          data: {
            optInStatus: 'OPTED_IN',
            optInAt: new Date(),
          },
        });
        updatedCount = result.count;
        break;
      }

      case 'tag': {
        // Add tag to each contact's tags array individually
        for (const contact of contacts) {
          const currentTags = Array.isArray(contact.tags) ? (contact.tags as string[]) : [];
          if (!currentTags.includes(tag!)) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { tags: [...currentTags, tag!] },
            });
            updatedCount++;
          }
        }
        break;
      }

      case 'untag': {
        // Remove tag from each contact's tags array individually
        for (const contact of contacts) {
          const currentTags = Array.isArray(contact.tags) ? (contact.tags as string[]) : [];
          if (currentTags.includes(tag!)) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { tags: currentTags.filter(t => t !== tag) },
            });
            updatedCount++;
          }
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (error) {
    console.error('[Contacts Bulk] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
