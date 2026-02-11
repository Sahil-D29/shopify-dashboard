import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'partially_refunded', label: 'Partially Refunded' },
  ];

  return NextResponse.json({ options: statuses });
}

