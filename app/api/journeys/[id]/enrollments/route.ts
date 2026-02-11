import { NextRequest, NextResponse } from 'next/server';

import { getEnrollments } from '@/lib/journey-engine/storage';

export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: journeyId } = await params;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '50');

  const all = getEnrollments().filter(enrollment => enrollment.journeyId === journeyId);

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
    data: filtered.slice(start, end),
  });
}

