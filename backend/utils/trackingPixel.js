// backend/utils/trackingPixel.js
import crypto from 'crypto';

const TRACKING_SECRET = process.env.EMAIL_TRACKING_SECRET || 'email-tracking-secret-key';

function generateToken(data) {
  const payload = JSON.stringify(data);
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', TRACKING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expectedSig = crypto.createHmac('sha256', TRACKING_SECRET).update(encoded).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }
}

export function generatePixelUrl(baseUrl, campaignId, subscriberEmail) {
  const token = generateToken({ c: campaignId, e: subscriberEmail, t: 'open' });
  return `${baseUrl}/api/email/track/open/${token}`;
}

export function generateClickTrackingUrl(baseUrl, campaignId, subscriberEmail, originalUrl, linkIndex) {
  const token = generateToken({ c: campaignId, e: subscriberEmail, u: originalUrl, i: linkIndex, t: 'click' });
  return `${baseUrl}/api/email/track/click/${token}`;
}

export function generateUnsubscribeUrl(baseUrl, subscriberEmail, storeId) {
  const token = generateToken({ e: subscriberEmail, s: storeId, t: 'unsub' });
  return `${baseUrl}/api/email/unsubscribe/${token}`;
}

// 1x1 transparent GIF
export const TRACKING_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
