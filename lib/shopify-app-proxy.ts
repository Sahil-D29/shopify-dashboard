import crypto from 'crypto';

export function verifyShopifyAppProxy(params: URLSearchParams, secret: string): boolean {
  const signature = params.get('signature');
  if (!signature || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const grouped = new Map<string, string[]>();
  for (const [key, value] of params.entries()) {
    if (key === 'signature') continue;
    const values = grouped.get(key) ?? [];
    values.push(value);
    grouped.set(key, values);
  }
  const message = Array.from(grouped.entries())
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .sort()
    .join('');
  const expected = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

export function appProxyTimestampIsFresh(params: URLSearchParams, maxAgeSeconds = 300): boolean {
  const timestamp = Number(params.get('timestamp'));
  if (!Number.isFinite(timestamp)) return false;
  return Math.abs(Date.now() / 1000 - timestamp) <= maxAgeSeconds;
}
