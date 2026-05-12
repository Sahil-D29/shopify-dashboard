/**
 * Cross-Sell post-purchase email pipeline.
 *
 * Trigger graph:
 *  Shopify orders/create webhook
 *    -> processOrderForCrossSell(storeId, order)
 *       -> finds matching ACTIVE CrossSellRules where sourceProductIds
 *          intersects with order line items (or rule's sources is empty
 *          = matches any product)
 *       -> creates CrossSellLog rows scheduledFor = now + rule.emailDelayHours
 *
 *  Cron: /api/cron/email-cross-sell-runner ticks every minute
 *    -> processScheduledCrossSells()
 *       -> finds CrossSellLog where status=SCHEDULED and scheduledFor <= now
 *       -> for each, sends email via Resend; marks SENT or FAILED
 *       -> SKIPPED if the customer is in the suppression list
 *          (BOUNCED/COMPLAINED/UNSUBSCRIBED on EmailSubscriber)
 */

import { prisma } from '@/lib/prisma';
import {
  isResendConfigured,
  ResendApiError,
  sendEmail,
} from '@/lib/email/resend';
import { compileEmailDocument, parseEmailDocument } from '@/lib/email/blocks/compile';

interface ShopifyLineItem {
  product_id?: number;
  variant_id?: number;
  title?: string;
}

interface ShopifyOrder {
  id?: number;
  email?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  line_items?: ShopifyLineItem[];
}

function personalize(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function defaultCrossSellHtml(): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Hi {{first_name}},</h1>
    <p style="color:#555;font-size:16px;line-height:1.6;">
      Thanks for your recent order! Based on what you bought, we picked out a few items
      we think you'll love.
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="{{shop_url}}" style="display:inline-block;background:#e94560;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:6px;">
        Browse Recommendations
      </a>
    </p>
    <p style="font-size:13px;color:#999;margin:24px 0 0;text-align:center;">
      Thanks for shopping with {{shop_name}}.
    </p>
  </div>
</body></html>`;
}

export interface ProcessOrderResult {
  storeId: string;
  shopifyOrderId: string;
  matchedRules: number;
  scheduled: number;
  skipped: number;
}

export async function processOrderForCrossSell(
  storeId: string,
  order: ShopifyOrder,
): Promise<ProcessOrderResult> {
  const shopifyOrderId = String(order.id ?? '');
  const result: ProcessOrderResult = {
    storeId,
    shopifyOrderId,
    matchedRules: 0,
    scheduled: 0,
    skipped: 0,
  };
  if (!shopifyOrderId) return result;

  const customerEmail = (order.email ?? order.customer?.email ?? '').trim().toLowerCase();
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return result;
  }

  const lineItemProductIds = new Set(
    (order.line_items ?? [])
      .map(li => (li.product_id ? String(li.product_id) : null))
      .filter((x): x is string => Boolean(x)),
  );

  const rules = await prisma.crossSellRule.findMany({
    where: { storeId, status: 'ACTIVE' },
  });

  const customerName =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || null;

  for (const rule of rules) {
    // Match: empty sourceProductIds = match any order; otherwise require intersection
    const matched =
      rule.sourceProductIds.length === 0 ||
      rule.sourceProductIds.some(id => lineItemProductIds.has(id));
    if (!matched) continue;
    result.matchedRules++;

    const matchedIds =
      rule.sourceProductIds.length === 0
        ? Array.from(lineItemProductIds)
        : rule.sourceProductIds.filter(id => lineItemProductIds.has(id));

    const scheduledFor = new Date(Date.now() + rule.emailDelayHours * 60 * 60 * 1000);

    try {
      await prisma.crossSellLog.create({
        data: {
          storeId,
          ruleId: rule.id,
          shopifyOrderId,
          customerEmail,
          customerName,
          status: 'SCHEDULED',
          scheduledFor,
          matchedProductIds: matchedIds,
        },
      });
      result.scheduled++;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        // Already scheduled for this rule+order (unique constraint)
        result.skipped++;
      } else {
        throw error;
      }
    }

    // Increment trigger count (best-effort)
    await prisma.crossSellRule
      .update({
        where: { id: rule.id },
        data: { triggerCount: { increment: 1 } },
      })
      .catch(() => null);
  }

  return result;
}

export interface ProcessScheduledResult {
  picked: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ logId: string; error: string }>;
}

export async function processScheduledCrossSells(): Promise<ProcessScheduledResult> {
  const result: ProcessScheduledResult = {
    picked: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (!isResendConfigured()) {
    return result;
  }

  const due = await prisma.crossSellLog.findMany({
    where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
    take: 50,
    orderBy: { scheduledFor: 'asc' },
    include: { rule: true },
  });
  result.picked = due.length;
  if (due.length === 0) return result;

  for (const log of due) {
    try {
      const rule = log.rule;
      // Suppression check
      const suppressed = await prisma.emailSubscriber.findUnique({
        where: { storeId_email: { storeId: log.storeId, email: log.customerEmail } },
        select: { status: true },
      });
      if (
        suppressed &&
        ['UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'].includes(suppressed.status)
      ) {
        await prisma.crossSellLog.update({
          where: { id: log.id },
          data: { status: 'SKIPPED', errorMessage: `Subscriber status: ${suppressed.status}` },
        });
        result.skipped++;
        continue;
      }

      const fromEmail = rule.fromEmail.trim();
      const fromName = rule.fromName.trim();
      if (!fromEmail || !fromName) {
        await prisma.crossSellLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', errorMessage: 'Rule missing fromName/fromEmail' },
        });
        result.failed++;
        continue;
      }

      // Validate domain is verified
      const fromDomain = fromEmail.split('@')[1];
      const verified = await prisma.emailDomain.findFirst({
        where: {
          storeId: log.storeId,
          status: 'VERIFIED',
          name: { equals: fromDomain, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!verified) {
        await prisma.crossSellLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            errorMessage: `Domain ${fromDomain} not verified`,
          },
        });
        result.failed++;
        continue;
      }

      const store = await prisma.store.findUnique({
        where: { id: log.storeId },
        select: { storeName: true, shopifyDomain: true },
      });

      // Compile body: prefer jsonDesign (blocks) → htmlBody → default template
      const parsedDoc = parseEmailDocument(rule.jsonDesign);
      let html: string;
      if (parsedDoc) {
        html = compileEmailDocument(parsedDoc);
      } else if (rule.htmlBody && rule.htmlBody.trim()) {
        html = rule.htmlBody;
      } else {
        html = defaultCrossSellHtml();
      }

      const [firstName, ...rest] = (log.customerName ?? '').trim().split(/\s+/);
      const mergeVars: Record<string, string> = {
        first_name: firstName || 'there',
        last_name: rest.join(' '),
        email: log.customerEmail,
        shop_name: store?.storeName ?? '',
        shop_url: store?.shopifyDomain ? `https://${store.shopifyDomain}` : '',
        unsubscribe_url: '#',
        current_year: String(new Date().getFullYear()),
      };

      const sendResult = await sendEmail({
        from: `${fromName} <${fromEmail}>`,
        to: log.customerEmail,
        subject: personalize(rule.subject, mergeVars),
        html: personalize(html, mergeVars),
        tags: [
          { name: 'kind', value: 'cross_sell' },
          { name: 'rule_id', value: rule.id },
          { name: 'log_id', value: log.id },
          { name: 'store_id', value: log.storeId },
        ],
      });

      await prisma.crossSellLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          resendEmailId: sendResult.id,
        },
      });
      await prisma.crossSellRule
        .update({
          where: { id: rule.id },
          data: { sentCount: { increment: 1 } },
        })
        .catch(() => null);
      result.sent++;
    } catch (error) {
      const message =
        error instanceof ResendApiError ? error.message : (error as Error).message;
      await prisma.crossSellLog
        .update({
          where: { id: log.id },
          data: { status: 'FAILED', errorMessage: message },
        })
        .catch(() => null);
      result.errors.push({ logId: log.id, error: message });
      result.failed++;
    }
  }

  return result;
}
