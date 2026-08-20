export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAccess } from '@/lib/debug-access';
import { resolveStore } from '@/lib/tenant/resolve-store';

export async function GET(request: NextRequest) {
  const blocked = await requireDebugAccess(request);
  if (blocked) return blocked;

  const store = await resolveStore(request);

  return NextResponse.json({
    ok: Boolean(store),
    hasResolvedStore: Boolean(store),
    checkedAt: new Date().toISOString(),
  });
}
