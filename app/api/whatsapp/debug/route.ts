export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAccess } from '@/lib/debug-access';
import { getTemplates } from '@/lib/whatsapp/templates-store';

export async function GET(request: NextRequest) {
  const blocked = await requireDebugAccess(request);
  if (blocked) return blocked;

  const templates = getTemplates();

  return NextResponse.json({
    ok: true,
    templatesCount: templates.length,
    checkedAt: new Date().toISOString(),
  });
}
