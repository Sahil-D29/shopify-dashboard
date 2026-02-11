import { NextResponse } from 'next/server';

/**
 * GET /api/auth/providers
 * Must return the same shape as Auth.js so signIn('google') and signIn('credentials') work.
 * NextAuth client expects: { [providerId]: { id, name, type } }.
 * Include credentials so manual sign-in/sign-up can use signIn('credentials').
 * Also include googleEnabled for backward compatibility with UI checks.
 */
export async function GET() {
  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
  const providers: Record<string, { id: string; name: string; type: string }> = {
    credentials: { id: 'credentials', name: 'Credentials', type: 'credentials' },
  };
  if (googleEnabled) {
    providers.google = { id: 'google', name: 'Google', type: 'oauth' };
  }
  return NextResponse.json({ ...providers, googleEnabled });
}
