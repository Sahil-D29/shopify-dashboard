export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { encrypt } from '@/lib/encryption';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

const VALID_DATA_TYPES = ['contacts', 'events', 'facebook_fbp'];

export function newPublicId(): string {
  return 'whk_' + crypto.randomBytes(9).toString('hex'); // 18 hex chars
}
export function newSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('hex');
}
export function ingestUrl(publicId: string): string {
  return `${getBaseUrl().replace(/\/$/, '')}/api/webhooks/ingest/${publicId}`;
}

/** Shape returned to the client (never the raw secret, except right after create/regenerate). */
function toClient(row: any, opts?: { revealSecret?: string }) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dataTypes: row.dataTypes,
    events: row.events,
    isActive: row.isActive,
    publicId: row.publicId,
    url: ingestUrl(row.publicId),
    secretMasked: '••••••••••••', // secret shown once on create/regenerate (Stripe-style)
    secret: opts?.revealSecret, // only present immediately after create/regenerate
    lastReceivedAt: row.lastReceivedAt,
    receivedCount: row.receivedCount,
    failureCount: row.failureCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const userContext = await getUserContext(request);
  if (!userContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

  const rows = await prisma.webhookIntegration.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ webhooks: rows.map(r => toClient(r)) });
}

export async function POST(request: NextRequest) {
  const userContext = await getUserContext(request);
  if (!userContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const dataTypes: string[] = Array.isArray(body.dataTypes)
    ? body.dataTypes.filter((t: unknown): t is string => typeof t === 'string' && VALID_DATA_TYPES.includes(t))
    : [];
  const events: string[] = Array.isArray(body.events)
    ? body.events.filter((e: unknown): e is string => typeof e === 'string')
    : [];

  const secret = newSecret();
  try {
    const row = await prisma.webhookIntegration.create({
      data: {
        storeId,
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description : null,
        dataTypes,
        events,
        publicId: newPublicId(),
        secretEnc: encrypt(secret),
        isActive: body.isActive !== false,
      },
    });
    // Return the plaintext secret ONCE so the user can copy it.
    return NextResponse.json({ webhook: toClient(row, { revealSecret: secret }) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A webhook with this name already exists' }, { status: 409 });
    }
    console.error('[integrations/webhooks POST]', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
