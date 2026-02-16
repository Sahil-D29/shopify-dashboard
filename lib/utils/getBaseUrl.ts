/**
 * Get the base URL for the application (for server and client).
 * Never returns localhost in production.
 * Env order: NEXT_PUBLIC_APP_URL | NEXTAUTH_URL | NEXT_PUBLIC_BASE_URL | RENDER_EXTERNAL_URL | client origin | localhost (dev only)
 */
export function getBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) {
    // Never use localhost in production
    if (process.env.NODE_ENV === 'production' && fromEnv.includes('localhost')) {
      console.warn('[getBaseUrl] NEXTAUTH_URL contains localhost in production — ignoring');
    } else {
      return fromEnv.replace(/\/$/, '');
    }
  }

  // Render auto-sets RENDER_EXTERNAL_URL (e.g. https://my-app.onrender.com)
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[getBaseUrl] NEXTAUTH_URL or NEXT_PUBLIC_APP_URL must be set in production');
    // Return empty string instead of throwing to avoid crashing the entire app
    return '';
  }
  return 'http://localhost:3002';
}
