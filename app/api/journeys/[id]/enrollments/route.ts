export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getEnrollments } from '@/lib/journey-engine/storage';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getEnrollmentMessageStates } from '@/lib/journey-engine/operational-analytics';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: journeyId } = await params;
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const journey = await prisma.journeyDoc.findFirst({ where: { id: journeyId, storeId }, select: { id: true } });
  if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '50');

  const all = (await getEnrollments()).filter(enrollment => enrollment.journeyId === journeyId);
  const messageStates = await getEnrollmentMessageStates(storeId, journeyId);

  const filtered = all.filter(enrollment => {
    if (statusFilter && enrollment.status !== statusFilter) return false;
    if (from && Date.parse(enrollment.enteredAt) < Date.parse(from)) return false;
    if (to && Date.parse(enrollment.enteredAt) > Date.parse(to)) return false;
    return true;
  });

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return NextResponse.json({
    total: filtered.length,
    page,
    pageSize,
    data: filtered.slice(start, end).map(enrollment => ({
      ...enrollment,
      message: messageStates.get(enrollment.id) ?? null,
    })),
  });
}

