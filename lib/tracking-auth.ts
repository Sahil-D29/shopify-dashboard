import crypto from 'crypto';

const TRACKING_KEY_VERSION = 'v1';

export function getTrackingSecret(): string | null {
  return (
    process.env.TRACKING_SECRET ||
    process.env.CRON_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    null
  );
}

export function createTrackingKey(storeId: string): string {
  const secret = getTrackingSecret();
  if (!secret) {
    throw new Error('Tracking secret is not configured');
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${TRACKING_KEY_VERSION}:${storeId}`)
    .digest('hex');

  return `${TRACKING_KEY_VERSION}_${digest}`;
}

export function verifyTrackingKey(storeId: string, candidate: unknown): boolean {
  if (typeof candidate !== 'string' || !candidate.trim()) return false;

  let expected: string;
  try {
    expected = createTrackingKey(storeId);
  } catch {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const candidateBuffer = Buffer.from(candidate.trim(), 'utf8');

  if (expectedBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}
