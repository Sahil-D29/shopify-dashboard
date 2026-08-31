export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  void request;
  return NextResponse.json({
    locations: [],
    unavailable: true,
    message: 'Inventory locations are not part of the current production product.',
    lastSynced: Date.now(),
  });
}

