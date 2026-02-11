/**
 * Edge-compatible auth config (e.g. for future middleware use).
 * Uses Auth.js default cookie names (authjs.session-token) to match lib/auth.ts and middleware.
 */
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [],
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/auth/signin' },
};
