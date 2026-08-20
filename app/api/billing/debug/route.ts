export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAccess } from '@/lib/debug-access';
import { isRazorpayConfigured } from '@/lib/razorpay';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export async function GET(request: NextRequest) {
  const blocked = await requireDebugAccess(request);
  if (blocked) return blocked;

  const storeId = await getCurrentStoreId(request);

  return NextResponse.json({
    ok: true,
    hasStoreContext: Boolean(storeId),
    razorpayReady: isRazorpayConfigured(),
    checkedAt: new Date().toISOString(),
  });
}
