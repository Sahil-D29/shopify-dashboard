import { NextResponse } from 'next/server';

import { executionLogStore } from '@/app/api/journeys/mock-stores';

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(params);
  executionLogStore.set(id, []);
  return NextResponse.json({ success: true });
}



