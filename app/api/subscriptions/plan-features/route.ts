import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plans = await prisma.planFeature.findMany({
      orderBy: { price: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Plan features API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
