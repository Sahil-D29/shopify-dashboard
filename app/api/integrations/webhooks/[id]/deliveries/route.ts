export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';

/** GET — recent received payloads for this integration (for the deliveries panel). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userContext = await getUserContext(request);
  if (!userContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

  const { id } = await params;
  const integration = await prisma.webhookIntegration.findFirst({
    where: { id, storeId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const deliveries = await prisma.webhookEvent.findMany({
    where: { integrationId: id, storeId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ deliveries });
}
