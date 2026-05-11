import { NextResponse } from 'next/server';
import { readUsers } from '@/lib/fileAuth';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ 
        valid: false,
        error: 'Token is required'
      });
    }

    const users = await readUsers();
    const user = users.find((u) => {
      if (!u.resetToken || !u.resetTokenExpiry) return false;
      
      // Check if token matches
      if (u.resetToken !== token) return false;
      
      // Check if token is not expired
      const expiryDate = new Date(u.resetTokenExpiry);
      return expiryDate > new Date();
    });

    if (!user) {
      return NextResponse.json({ 
        valid: false,
        error: 'Invalid or expired reset token'
      });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Verify reset token error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Verification failed' 
    });
  }
}

