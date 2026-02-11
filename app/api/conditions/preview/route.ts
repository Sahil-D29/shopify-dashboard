import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const seed = JSON.stringify(payload).length;
    const totalAudience = 5000 + (seed % 2000);
    const truePercentage = 20 + ((seed * 13) % 60);
    const falsePercentage = Math.max(0, 100 - truePercentage);
    const trueCount = Math.round((truePercentage / 100) * totalAudience);
    const falseCount = totalAudience - trueCount;

    return NextResponse.json({
      trueCount,
      falseCount,
      truePercentage,
      falsePercentage,
      totalAudience,
      estimatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[conditions][preview][POST]', error);
    return NextResponse.json(
      { error: 'Failed to generate audience preview.' },
      { status: 500 },
    );
  }
}



