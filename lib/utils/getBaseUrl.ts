/**
 * Get the base URL for the application (for server and client).
 * Priority: NEXT_PUBLIC_APP_URL > NEXTAUTH_URL > NEXT_PUBLIC_BASE_URL > RENDER_EXTERNAL_URL > window.origin > localhost
 *
 * IMPORTANT: Always returns a usable URL. Even when NODE_ENV=production
 * and only a localhost URL is available we still return it — an empty
 * string would silently break every OAuth redirect, webhook callback,
 * and absolute link.
 */
export function getBaseUrl(): string {
  // 1. Explicit env vars (most specific first)
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) {
    if (process.env.NODE_ENV === 'production' && fromEnv.includes('localhost')) {
      console.warn(
        '[getBaseUrl] Using localhost URL in production — set NEXT_PUBLIC_APP_URL to your real domain',
      );
    }
    return fromEnv.replace(/\/$/, '');
  }

  // 2. Render auto-sets RENDER_EXTERNAL_URL
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }

  // 3. Client-side: use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // 4. Fallback — localhost (works in dev, prints warning in prod)
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[getBaseUrl] No APP_URL configured in production — falling back to localhost:3002',
    );
  }
  return 'http://localhost:3002';
}
