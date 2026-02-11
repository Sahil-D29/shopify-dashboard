/**
 * Get the base URL for the application (for server and client).
 * Never returns localhost in production.
 * Env order: NEXT_PUBLIC_APP_URL | NEXTAUTH_URL | NEXT_PUBLIC_BASE_URL | client origin | localhost (dev only)
 */
export function getBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) {
    // Never use localhost in production
    if (process.env.NODE_ENV === 'production' && fromEnv.includes('localhost')) {
      throw new Error('NEXTAUTH_URL/NEXT_PUBLIC_APP_URL must not be localhost in production');
    }
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_URL or NEXT_PUBLIC_APP_URL must be set in production (e.g. on Render)');
  }
  return 'http://localhost:3002';
}
