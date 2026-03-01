export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/debug
 * Returns auth configuration diagnostics (no secrets exposed).
 * Helps diagnose Google OAuth redirect_uri_mismatch and other config issues.
 */
export async function GET(request: NextRequest) {
  const authUrl = process.env.AUTH_URL;
  const nextauthUrl = process.env.NEXTAUTH_URL;
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL;
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  const resolvedBase = authUrl || nextauthUrl || nextPublicAppUrl || renderExternalUrl || '(none)';
  const callbackUrl = resolvedBase !== '(none)'
    ? `${resolvedBase.replace(/\/$/, '')}/api/auth/callback/google`
    : '(cannot determine)';

  const requestHost = request.headers.get('host') || '(unknown)';
  const requestProtocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');

  return NextResponse.json({
    status: 'ok',
    env: {
      AUTH_URL: authUrl ? '✅ set' : '❌ not set',
      NEXTAUTH_URL: nextauthUrl ? `✅ ${nextauthUrl}` : '❌ not set',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ set' : (process.env.AUTH_SECRET ? '✅ set (as AUTH_SECRET)' : '❌ not set'),
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ set' : '❌ not set',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ set' : '❌ not set',
      RENDER_EXTERNAL_URL: renderExternalUrl ? `✅ ${renderExternalUrl}` : '❌ not set',
      NEXT_PUBLIC_APP_URL: nextPublicAppUrl ? `✅ ${nextPublicAppUrl}` : '⬜ not set (optional)',
    },
    resolved: {
      baseUrl: resolvedBase,
      googleCallbackUrl: callbackUrl,
    },
    request: {
      host: requestHost,
      protocol: requestProtocol,
    },
    instructions: {
      step1: 'The "googleCallbackUrl" above must EXACTLY match one of the Authorized redirect URIs in Google Cloud Console.',
      step2: 'If NEXTAUTH_URL is not set, set it in Render Environment Variables to: https://shopify-dashboard-8plv.onrender.com',
      step3: 'In Google Cloud Console, the redirect URI must be: https://shopify-dashboard-8plv.onrender.com/api/auth/callback/google',
    },
  });
}
