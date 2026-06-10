/**
 * Helpers for calling the Meta WhatsApp Graph API from the server.
 *
 * Meta requires an `appsecret_proof` argument on server-side API calls when the
 * app has "Require app secret proof for server API calls" enabled (default for
 * newer apps, and required for system-user tokens from Embedded Signup).
 *
 * `appsecret_proof` = HMAC-SHA256(access_token) keyed with the app secret,
 * hex-encoded. It is appended as a query parameter on every Graph request.
 */
import crypto from 'crypto';

/** Compute appsecret_proof for an access token. Returns null if no app secret. */
export function getAppSecretProof(accessToken: string, appSecret?: string): string | null {
  const secret = appSecret || process.env.META_APP_SECRET;
  if (!secret || !accessToken) return null;
  return crypto.createHmac('sha256', secret).update(accessToken).digest('hex');
}

/**
 * Build a fully-qualified graph.facebook.com URL with `appsecret_proof`
 * appended (when an app secret is available).
 *
 * @param path  Graph path WITHOUT the host, e.g. `v21.0/123/messages`
 * @param accessToken  The bearer token (used to derive the proof)
 * @param search  Optional query params to include
 */
export function graphUrl(
  path: string,
  accessToken: string,
  search?: Record<string, string>,
): string {
  const url = new URL(`https://graph.facebook.com/${path.replace(/^\/+/, '')}`);
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }
  const proof = getAppSecretProof(accessToken);
  if (proof) url.searchParams.set('appsecret_proof', proof);
  return url.toString();
}
