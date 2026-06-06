export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, fetchWABAInfo, saveWhatsAppConfig } from '@/lib/whatsapp/embedded-signup';

/**
 * Facebook redirects here after the user grants access in the OAuth dialog.
 *
 * Instead of bouncing the code to the frontend (which caused redirect_uri
 * mismatch errors), this callback now directly:
 *   1. Exchanges the code for an access token (using THIS url as redirect_uri
 *      — guaranteed to match the one used in the OAuth dialog).
 *   2. Fetches the user's WABA + phone number.
 *   3. Saves the WhatsApp config.
 *   4. Redirects to /settings?connected=true.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state'); // storeId
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const settingsUrl = `${baseUrl}/settings`;

  if (error) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent('Missing authorization code')}`
    );
  }

  try {
    // The redirect_uri MUST match what was used in the OAuth dialog (GET handler).
    // Since that handler builds it as `${baseUrl}/api/whatsapp/embedded-signup/callback`,
    // we use the exact same value here.
    const redirectUri = `${baseUrl}/api/whatsapp/embedded-signup/callback`;

    const { accessToken } = await exchangeCodeForToken(code, redirectUri);
    const { businesses } = await fetchWABAInfo(accessToken);

    if (businesses.length === 0) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('No WhatsApp Business Accounts found for this Facebook account')}`
      );
    }

    // Auto-select the first WABA + phone number
    const biz = businesses[0];
    const phone = biz.phoneNumbers?.[0];

    if (!biz.wabaId && !biz.id) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('No WhatsApp Business Account ID found')}`
      );
    }

    if (!phone?.id) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent('No phone number found on your WhatsApp Business Account')}`
      );
    }

    await saveWhatsAppConfig(
      state, // storeId passed through the OAuth state param
      biz.wabaId || biz.id,
      phone.id,
      accessToken,
      biz.name
    );

    return NextResponse.redirect(`${settingsUrl}?connected=true`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete WhatsApp setup';
    console.error('[embedded-signup][callback]', message);
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(message)}`
    );
  }
}
