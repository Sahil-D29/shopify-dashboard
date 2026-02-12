export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import type { ContactCreatePayload } from '@/lib/types/contact';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

// GET /api/contacts - List contacts with pagination, search, filters
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const optInStatus = searchParams.get('optInStatus') || '';
    const tag = searchParams.get('tag') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const where: Record<string, unknown> = { storeId };

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (source) {
      where.source = source;
    }

    if (optInStatus) {
      where.optInStatus = optInStatus;
    }

    if (tag) {
      where.tags = { array_contains: [tag] };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: where as any,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where: where as any }),
    ]);

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Contacts GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a new contact
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

    const body: ContactCreatePayload = await request.json();

    if (!body.phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const phone = normalizePhone(body.phone);

    // Check for duplicate
    const existing = await prisma.contact.findUnique({
      where: { storeId_phone: { storeId, phone } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Contact with this phone number already exists', existingId: existing.id },
        { status: 409 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        storeId,
        phone,
        name: body.name || body.firstName ? `${body.firstName || ''} ${body.lastName || ''}`.trim() : null,
        email: body.email || null,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        tags: body.tags || [],
        optInStatus: body.optInStatus || 'NOT_SET',
        source: body.source || 'MANUAL',
        shopifyCustomerId: body.shopifyCustomerId || null,
        customFields: (body.customFields || {}) as any,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('[Contacts POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    );
  }
}
