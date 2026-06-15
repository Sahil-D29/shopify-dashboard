export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

const VALID_DATA_TYPES = ['contacts', 'events', 'facebook_fbp'];

function toClient(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dataTypes: row.dataTypes,
    events: row.events,
    isActive: row.isActive,
    publicId: row.publicId,
    url: `${getBaseUrl().replace(/\/$/, '')}/api/webhooks/ingest/${row.publicId}`,
    secretMasked: '••••••••••••',
    lastReceivedAt: row.lastReceivedAt,
    receivedCount: row.receivedCount,
    failureCount: row.failureCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function authStore(request: NextRequest) {
  const userContext = await getUserContext(request);
  if (!userContext) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return { error: NextResponse.json({ error: 'Store ID required' }, { status: 400 }) };
  return { storeId };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authStore(request);
  if (a.error) return a.error;
  const { id } = await params;
  const row = await prisma.webhookIntegration.findFirst({ where: { id, storeId: a.storeId } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ webhook: toClient(row) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authStore(request);
  if (a.error) return a.error;
  const { id } = await params;

  const existing = await prisma.webhookIntegration.findFirst({ where: { id, storeId: a.storeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.name === 'string') data.name = body.name.trim();
  if (typeof body.description === 'string') data.description = body.description;
  if (Array.isArray(body.dataTypes)) {
    data.dataTypes = body.dataTypes.filter((t: unknown): t is string => typeof t === 'string' && VALID_DATA_TYPES.includes(t));
  }
  if (Array.isArray(body.events)) {
    data.events = body.events.filter((e: unknown): e is string => typeof e === 'string');
  }
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

  try {
    const row = await prisma.webhookIntegration.update({ where: { id }, data });
    return NextResponse.json({ webhook: toClient(row) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A webhook with this name already exists' }, { status: 409 });
    }
    console.error('[integrations/webhooks PUT]', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authStore(request);
  if (a.error) return a.error;
  const { id } = await params;

  const existing = await prisma.webhookIntegration.findFirst({ where: { id, storeId: a.storeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.webhookIntegration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
