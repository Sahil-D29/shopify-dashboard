export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUserStats } from '@/lib/fileAuth';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await getUserStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}

