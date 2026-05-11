import { NextResponse } from 'next/server';
import { readUsers, writeUsers } from '@/lib/fileAuth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find user with valid token
    const users = await readUsers();
    const userIndex = users.findIndex((u) => {
      if (!u.resetToken || !u.resetTokenExpiry) return false;
      
      // Check if token matches
      if (u.resetToken !== token) return false;
      
      // Check if token is not expired
      const expiryDate = new Date(u.resetTokenExpiry);
      return expiryDate > new Date();
    });

    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    users[userIndex].password = hashedPassword;
    users[userIndex].resetToken = null;
    users[userIndex].resetTokenExpiry = null;
    
    await writeUsers(users);

    return NextResponse.json({ 
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

