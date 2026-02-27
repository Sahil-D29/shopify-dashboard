export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { brandName: true, onboardingComplete: true },
    });

    if (!user) {
      return NextResponse.json({ brandName: null, onboardingComplete: false });
    }

    // Auto-complete onboarding for existing users who already have a store
    if (!user.onboardingComplete) {
      const hasStore = await prisma.store.findFirst({
        where: {
          owner: { email: session.user.email.toLowerCase() },
          isActive: true,
        },
        select: { id: true },
      });

      if (hasStore) {
        await prisma.user.update({
          where: { email: session.user.email.toLowerCase() },
          data: { onboardingComplete: true },
        });
        return NextResponse.json({ brandName: user.brandName, onboardingComplete: true });
      }
    }

    return NextResponse.json({
      brandName: user.brandName,
      onboardingComplete: user.onboardingComplete,
    });
  } catch (error) {
    console.error('[Onboarding GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandName } = body;

    if (!brandName || typeof brandName !== 'string') {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const trimmed = brandName.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return NextResponse.json(
        { error: 'Brand name must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { email: session.user.email.toLowerCase() },
      data: {
        brandName: trimmed,
        onboardingComplete: true,
      },
      select: { brandName: true, onboardingComplete: true },
    });

    return NextResponse.json({ success: true, ...user });
  } catch (error) {
    console.error('[Onboarding POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
