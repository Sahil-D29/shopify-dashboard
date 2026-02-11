export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/auth/admin-auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request);

    if (session) {
      // Log logout action
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       null;

      await logAdminAction(
        session.userId,
        'admin_logout',
        {},
        ipAddress,
        'success'
      );
    }

    // Clear admin session cookie
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}

