export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

import { executionLogStore } from '@/app/api/journeys/mock-stores';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  executionLogStore.set(id, []);
  return NextResponse.json({ success: true });
}



