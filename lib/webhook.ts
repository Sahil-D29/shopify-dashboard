/**
 * Webhook verification helpers - HMAC for Shopify, signature for Stripe
 */
import crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC
 */
export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

/**
 * Verify Stripe webhook signature (use Stripe SDK constructEvent in route for full verification)
 * This is a helper for raw body + secret check.
 */
export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}
