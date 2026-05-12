/**
 * Back-in-Stock notification trigger.
 *
 * Two paths:
 *  - notifyVariantBackInStock(storeId, shopifyVariantId): runs when we
 *    learn (via webhook or manual trigger) that a specific variant has
 *    inventory > 0. Sends one email per PENDING subscription for that
 *    variant, marks them NOTIFIED.
 *
 * Uses the store's default verified domain for the From address. If no
 * verified domain exists, the trigger fails with a clear error so the
 * subscription stays PENDING and can be retried.
 */

import { prisma } from '@/lib/prisma';
import {
  isResendConfigured,
  ResendApiError,
  sendEmail,
} from '@/lib/email/resend';

export interface NotifyResult {
  storeId: string;
  shopifyVariantId: string;
  pending: number;
  sent: number;
  failed: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

function personalize(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function defaultBody(): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;text-align:center;">
    <h1 style="color:#1a1a2e;margin:0 0 12px;font-size:24px;">It's Back! 🎉</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Hi {{first_name}}, great news — <strong>{{product_title}}</strong> is back in stock.
    </p>
    {{product_image_block}}
    <p style="margin:24px 0;">
      <a href="{{product_url}}" style="display:inline-block;background:#e94560;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:6px;">
        Grab It Now
      </a>
    </p>
    <p style="font-size:13px;color:#999;margin:24px 0 0;">
      Hurry — it might sell out again soon.
    </p>
  </div>
</body></html>`;
}

export async function notifyVariantBackInStock(
  storeId: string,
  shopifyVariantId: string,
): Promise<NotifyResult> {
  const result: NotifyResult = {
    storeId,
    shopifyVariantId,
    pending: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (!isResendConfigured()) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const pending = await prisma.backInStockSubscription.findMany({
    where: { storeId, shopifyVariantId, status: 'PENDING' },
  });
  result.pending = pending.length;
  if (pending.length === 0) return result;

  // Resolve the From address: store's default verified email domain
  const defaultDomain = await prisma.emailDomain.findFirst({
    where: { storeId, status: 'VERIFIED', isDefault: true },
    select: { name: true },
  });
  const anyVerified = defaultDomain
    ? null
    : await prisma.emailDomain.findFirst({
        where: { storeId, status: 'VERIFIED' },
        select: { name: true },
      });
  const fromDomain = defaultDomain?.name ?? anyVerified?.name;
  if (!fromDomain) {
    throw new Error(
      'No verified sending domain. Add and verify a domain in /email/domains before triggering notifications.',
    );
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { storeName: true, shopifyDomain: true },
  });
  const fromAddress = `${store?.storeName ?? 'Store'} <hello@${fromDomain}>`;
  const bodyTemplate = defaultBody();

  for (const sub of pending) {
    try {
      const productImageBlock = sub.productImage
        ? `<img src="${sub.productImage}" alt="${sub.productTitle}" width="240" style="max-width:240px;height:auto;border-radius:8px;margin:8px 0;border:0;" />`
        : '';
      const vars: Record<string, string> = {
        first_name: sub.firstName ?? 'there',
        last_name: sub.lastName ?? '',
        email: sub.email,
        product_title: sub.productTitle,
        product_url: sub.productUrl ?? (store?.shopifyDomain ? `https://${store.shopifyDomain}` : '#'),
        product_image_block: productImageBlock,
        shop_name: store?.storeName ?? '',
        shop_url: store?.shopifyDomain ? `https://${store.shopifyDomain}` : '',
      };

      const sendResult = await sendEmail({
        from: fromAddress,
        to: sub.email,
        subject: `${sub.productTitle} is back in stock!`,
        html: personalize(bodyTemplate, vars),
        tags: [
          { name: 'kind', value: 'back_in_stock' },
          { name: 'subscription_id', value: sub.id },
          { name: 'store_id', value: storeId },
        ],
      });

      await prisma.backInStockSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'NOTIFIED',
          notifiedAt: new Date(),
          resendEmailId: sendResult.id,
        },
      });
      result.sent++;
    } catch (error) {
      const message =
        error instanceof ResendApiError ? error.message : (error as Error).message;
      result.errors.push({ subscriptionId: sub.id, error: message });
      result.failed++;
    }
  }

  return result;
}
