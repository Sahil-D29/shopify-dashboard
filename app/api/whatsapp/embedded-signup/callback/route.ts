export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// Facebook redirects here after user grants access
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state'); // storeId
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings/whatsapp?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings/whatsapp?error=${encodeURIComponent('Missing authorization code')}`
    );
  }

  // Redirect to settings page with code — the frontend will complete the flow
  return NextResponse.redirect(
    `${baseUrl}/settings/whatsapp?code=${encodeURIComponent(code)}&storeId=${encodeURIComponent(state)}`
  );
}
