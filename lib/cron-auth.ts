import { NextRequest, NextResponse } from 'next/server';

export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron] CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 500 });
    }

    return null;
  }

  const secretParam = request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');

  if (secretParam !== expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
