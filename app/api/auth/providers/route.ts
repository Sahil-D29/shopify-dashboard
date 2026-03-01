export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/providers
 * Must return the same shape as Auth.js so signIn('google') and signIn('credentials') work.
 * NextAuth client expects: { [providerId]: { id, name, type } }.
 * Include credentials so manual sign-in/sign-up can use signIn('credentials').
 * Also include googleEnabled for backward compatibility with UI checks.
 * Returns googleCallbackUrl so the UI can help diagnose redirect_uri_mismatch errors.
 */
export async function GET(request: NextRequest) {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
  const providers: Record<string, { id: string; name: string; type: string }> = {
    credentials: { id: 'credentials', name: 'Credentials', type: 'credentials' },
  };

  // Compute the Google callback URL that NextAuth will use, so the UI can help
  // diagnose redirect_uri_mismatch errors.
  let googleCallbackUrl: string | undefined;
  if (googleEnabled) {
    providers.google = { id: 'google', name: 'Google', type: 'oauth' };
    const baseUrl =
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      `${request.nextUrl.protocol}//${request.headers.get('host')}`;
    googleCallbackUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/callback/google`;
  }

  return NextResponse.json({ ...providers, googleEnabled, googleCallbackUrl });
}
