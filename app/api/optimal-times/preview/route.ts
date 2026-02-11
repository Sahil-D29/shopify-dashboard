import { NextResponse } from 'next/server';

const HOURLY_ENGAGEMENT = [
  { hour: 0, engagementRate: 0.02 },
  { hour: 6, engagementRate: 0.08 },
  { hour: 9, engagementRate: 0.15 },
  { hour: 10, engagementRate: 0.22 },
  { hour: 14, engagementRate: 0.18 },
  { hour: 18, engagementRate: 0.13 },
  { hour: 20, engagementRate: 0.12 },
];

export async function GET() {
  const best = HOURLY_ENGAGEMENT.reduce((acc, item) => (item.engagementRate > acc.engagementRate ? item : acc), HOURLY_ENGAGEMENT[0]);
  return NextResponse.json({
    historicalData: HOURLY_ENGAGEMENT,
    optimalWindow: { start: best.hour, end: (best.hour + 2) % 24 },
    dataSource: "last_30_days",
  });
}



