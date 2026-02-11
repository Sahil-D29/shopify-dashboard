export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const statuses = [
    { value: 'unfulfilled', label: 'Unfulfilled' },
    { value: 'partial', label: 'Partially Fulfilled' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'restocked', label: 'Restocked' },
  ];

  return NextResponse.json({ options: statuses });
}

