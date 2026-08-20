export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAccess } from '@/lib/debug-access';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  const blocked = await requireDebugAccess(request);
  if (blocked) return blocked;

  const storeId = await getCurrentStoreId(request);

  return NextResponse.json({
    ok: true,
    hasStoreContext: Boolean(storeId),
    checkedAt: new Date().toISOString(),
  });
}
