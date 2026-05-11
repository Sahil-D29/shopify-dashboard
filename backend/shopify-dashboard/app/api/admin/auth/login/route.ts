import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminToken, logAdminAction } from '@/lib/auth/admin-auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Verify admin credentials
    const admin = await verifyAdminPassword(email, password);

    if (!admin) {
      // Log failed login attempt
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       null;
      
      await logAdminAction(
        'unknown',
        'admin_login_failed',
        { email, reason: 'Invalid credentials' },
        ipAddress,
        'failed'
      );

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create admin JWT token
    const token = await createAdminToken(admin);

    // Get IP address for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     null;

    // Log successful login
    await logAdminAction(
      admin.id,
      'admin_login',
      { email: admin.email },
      ipAddress,
      'success'
    );

    // Set admin session cookie
    const cookieStore = await cookies();
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 3600; // 30 days or 1 hour

    cookieStore.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAge,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

