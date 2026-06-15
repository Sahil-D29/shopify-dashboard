export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { encrypt } from '@/lib/encryption';
import { newSecret } from '../../route';

/** POST — rotate the integration's secret token; returns the new secret once. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userContext = await getUserContext(request);
  if (!userContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.webhookIntegration.findFirst({ where: { id, storeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const secret = newSecret();
  await prisma.webhookIntegration.update({ where: { id }, data: { secretEnc: encrypt(secret) } });
  return NextResponse.json({ secret });
}
