export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const templates = await prisma.predefinedTemplate.findMany({
      where: {
        ...(category && { category }),
        ...(isActive !== null && { isActive: isActive !== 'false' }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Predefined templates GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();

    const { name, description, category, definition, isActive = true, isDefault = false, assignedTo } = body;

    if (!name || !category || !definition) {
      return NextResponse.json({ error: 'name, category, and definition are required' }, { status: 400 });
    }

    const validCategories = [
      'abandoned_cart', 'product_view', 'cart_reminder', 'checkout',
      'order_confirmation', 'welcome', 're_engagement', 'custom',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    const template = await prisma.predefinedTemplate.create({
      data: {
        name,
        description: description || null,
        category,
        definition,
        isActive,
        isDefault,
        assignedTo: assignedTo || null,
        createdBy: admin.email || 'admin',
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Predefined templates POST error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
