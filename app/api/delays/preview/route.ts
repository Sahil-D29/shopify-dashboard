import { NextRequest, NextResponse } from 'next/server';

import type { DelayPreviewScenario } from '@/lib/types/delay-config';

export async function POST(request: NextRequest) {
  try {
    await request.json(); // payload currently unused in mock
    const now = Date.now();
    const scenarios: DelayPreviewScenario[] = [
      {
        userEntersAt: new Date(now).toISOString(),
        userContinuesAt: new Date(now + 18 * 60 * 60 * 1000).toISOString(),
        explanation: 'Entry during quiet hours. User resumes at the next permitted send time.',
        warnings: ['Quiet hours applied'],
      },
      {
        userEntersAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
        userContinuesAt: new Date(now + 28 * 60 * 60 * 1000).toISOString(),
        explanation: 'Delay waits until 10:00 AM next day, skipping weekend hours.',
        warnings: ['Weekend skip applied'],
      },
      {
        userEntersAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        userContinuesAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        explanation: 'User already most of the way through the delay; resumes shortly.',
      },
    ];

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('[delays][preview][POST]', error);
    return NextResponse.json({ error: 'Failed to preview delay scenarios.' }, { status: 500 });
  }
}

