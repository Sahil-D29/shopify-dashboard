export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { generateApiKey } from '@/lib/api-key-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, apiKeys: keys });
  } catch (error) {
    console.error('[API Keys] List error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    }

    const body = await request.json();
    const name = body.name?.trim();

    if (!name || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { error: 'Name is required (1-100 characters)' },
        { status: 400 }
      );
    }

    const { key, record } = await generateApiKey(storeId, name);

    return NextResponse.json({
      success: true,
      apiKey: {
        ...record,
        key, // Full key returned only once
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[API Keys] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
