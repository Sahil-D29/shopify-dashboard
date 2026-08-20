export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAccess } from '@/lib/debug-access';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const blocked = await requireDebugAccess(request);
  if (blocked) return blocked;

  return NextResponse.json({
    status: 'ok',
    message: 'Test route is working!',
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}


