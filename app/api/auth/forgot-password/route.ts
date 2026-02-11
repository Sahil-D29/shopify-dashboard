export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { findUserByEmail, readUsers, writeUsers } from '@/lib/fileAuth';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await findUserByEmail(email);

    // Always return success even if user not found (security best practice)
    if (!user) {
      return NextResponse.json({ 
        success: true,
        message: 'If an account exists, reset instructions have been sent'
      });
    }

    // Don't allow password reset for OAuth-only users
    if (!user.password) {
      return NextResponse.json({ 
        success: true,
        message: 'If an account exists, reset instructions have been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Update user with reset token
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === user.id);
    
    if (userIndex !== -1) {
      users[userIndex].resetToken = resetToken;
      users[userIndex].resetTokenExpiry = resetTokenExpiry.toISOString();
      await writeUsers(users);
    }

    const baseUrl = getBaseUrl();
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Reset Your Password - Shopify Dashboard',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello ${user.name || 'there'},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              You requested to reset your password for your Shopify Dashboard account. Click the button below to proceed:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f9fafb; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              <strong>This link will expire in 1 hour.</strong>
            </p>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Reset instructions sent to email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

