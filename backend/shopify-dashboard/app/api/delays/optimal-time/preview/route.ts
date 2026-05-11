import { NextResponse } from 'next/server';

const HOURLY_ENGAGEMENT = Array.from({ length: 24 }, (_, hour) => {
  const base = [12, 8, 5, 4, 3, 6, 15, 22, 35, 48, 62, 58, 52, 45, 68, 72, 65, 58, 52, 48, 42, 35, 28, 18];
  return { hour, rate: base[hour] };
});

export async function GET() {
  return NextResponse.json({
    hourlyEngagement: HOURLY_ENGAGEMENT,
    bestTimeToSend: '15:00',
    timezone: 'customer',
  });
}



