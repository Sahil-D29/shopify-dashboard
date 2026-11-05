import { replayDeliveryReceipt } from '@/lib/whatsapp/delivery-receipts';
import { sendTemplate, resolveTemplate } from '@/lib/whatsapp/template-send';
import { buildTemplatePayload } from '@/lib/whatsapp/template-payload';
import { campaignTemplateInput } from '@/lib/whatsapp/campaign-config';
import { errorIssues, issue, SendValidationError } from '@/lib/whatsapp/issues';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { resolveSegmentCustomers } from '@/lib/segments/resolve-customers';
/**
 * Campaign worker - process one pending CampaignQueueItem per invocation.
 * Supports multi-segment targeting, sending speed rate-limiting, and preserves
 * queue items for audit trail instead of deleting them.
 */
import { ShopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Rate limit delays based on sendingSpeed */
const SPEED_DELAY_MS: Record<string, number> = {
  FAST: 60,     // ~1000/min
  MEDIUM: 120,  // ~500/min
  SLOW: 600,    // ~100/min
};

function personalizeBody(body: string, customer: ShopifyCustomer): string {
  const firstName = customer.first_name ?? 'Customer';
  const lastName = customer.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Customer';
  return body
    .replace(/\{\{name\}\}/g, fullName)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{last_name\}\}/g, lastName)
    .replace(/\{\{email\}\}/g, customer.email ?? '');
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function runCampaignWorkerStep(targetCampaignId?: string): Promise<{ processed: number; campaignId?: string; error?: string }> {
  const now = new Date();
  const candidate = await prisma.campaignQueueItem.findFirst({
    where: {
      status: 'PENDING',
      ...(targetCampaignId ? { campaignId: targetCampaignId } : {}),
      campaign: { status: { in: ['RUNNING', 'SCHEDULED'] } },
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    include: { campaign: { include: { segment: true } }, store: true },
  });

  if (!candidate) {
    return { processed: 0 };
  }

  const claim = await prisma.campaignQueueItem.updateMany({
    where: { id: candidate.id, status: 'PENDING' },
    data: { status: 'PROCESSING', startedAt: now },
  });
  if (!claim.count) return { processed: 0 };

  const { campaign, store } = candidate;
  const storeId = campaign.storeId;
  const messageTemplate = (campaign.messageTemplate ?? {}) as {
    body?: string;
    subject?: string;
    messageContent?: { body?: string; subject?: string };
    templateName?: string;
    language?: string;
  };
  const body = messageTemplate.body ?? messageTemplate.messageContent?.body ?? '';
  const subject = messageTemplate.subject ?? messageTemplate.messageContent?.subject ?? '';

  const templateInput = campaignTemplateInput(campaign);
  // Rate-limiting delay based on sendingSpeed
  const sendingSpeed = (campaign as any).sendingSpeed ?? 'MEDIUM';
  const delayBetweenMessages = SPEED_DELAY_MS[sendingSpeed] ?? SPEED_DELAY_MS.MEDIUM;

  try {
    // Build a Shopify client best-effort. The audience engine below merges the
    // store's Contacts with Shopify customers and degrades gracefully when
    // Shopify is unavailable, so a WhatsApp-only store still resolves recipients.
    const client = new ShopifyClient({
      shop: store?.shopifyDomain ?? '',
      accessToken: store?.accessToken
        ? (await import('@/lib/shopify-token')).getDecryptedToken({ accessToken: store.accessToken })
        : '',
    });

    const matchingCustomers = await resolveSegmentCustomers({ client, storeId,
      segmentIds: campaign.segmentIds?.length ? campaign.segmentIds : campaign.segmentId ? [campaign.segmentId] : [], forceRefresh: true });
    if (!matchingCustomers.length) throw new SendValidationError([issue('EMPTY_AUDIENCE', 'No recipients match the selected segment. Review your audience.', 'segmentIds')]);
    const isWhatsApp = !['EMAIL', 'SMS', 'PUSH'].includes(campaign.type);
    const definition = isWhatsApp ? await resolveTemplate(storeId, templateInput) : undefined;
    if (definition) buildTemplatePayload(definition, templateInput, {}, true);
    let sent = 0;
    let delivered = 0;
    let failed = 0;

    for (const customer of matchingCustomers) {
      const customerId = String(customer.id);
      const personalizedBody = personalizeBody(body, customer);

      const logSuccess = async (msg?: string) => {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            customerId,
            status: 'SUCCESS',
            message: msg ?? undefined,
            whatsappMessageId: msg ?? undefined,
            stepIndex: 0,
            windowExpiresAt: null,
          },
        });
        if (msg) await replayDeliveryReceipt(msg, storeId);
      };
      const logFailure = async (err: string, issues = [issue('SEND_FAILED', err)]) => {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            customerId,
            status: 'FAILED',
            error: err,
            metadata: JSON.parse(JSON.stringify({ issues, phone: customer.phone, templateName: templateInput.templateName })),
          },
        });
      };

      const campaignType = campaign.type;

      if (campaignType === 'EMAIL') {
        const email = customer.email ?? null;
        if (!email) {
          await logFailure('No email');
          failed++;
          continue;
        }
        try {
          await sendEmail({
            to: email,
            subject: subject || 'Message',
            html: personalizedBody,
            text: personalizedBody.replace(/<[^>]*>/g, ''),
          });
          await logSuccess();
          sent++;
          delivered++;
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          await logFailure(err);
          failed++;
        }
      } else if (campaignType === 'WHATSAPP' || campaignType === 'ONE_TIME' || campaignType === 'RECURRING' || campaignType === 'DRIP' || campaignType === 'TRIGGER_BASED') {
        // All new campaign types default to WhatsApp delivery
        const phone = normalizePhone(customer.phone ?? customer.default_address?.phone ?? '');
        try {
          const result = await sendTemplate(storeId, phone, templateInput, { customer }, definition);
          await logSuccess(result.messageId);
          sent++;
        } catch (error) {
          const issues = errorIssues(error);
          await logFailure(issues[0].message, issues);
          failed++;
        }
      } else if (campaignType === 'SMS' || campaignType === 'PUSH') {
        await logFailure(`${campaignType} provider is not configured`);
        failed++;
      }

      // Rate-limiting delay between messages
      if (delayBetweenMessages > 0) {
        await sleep(delayBetweenMessages);
      }
    }

    // Serialize against receipt counter updates, then derive the final result from logs.
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaign.id} FOR UPDATE`;
      const outcomes = await tx.campaignLog.findMany({ where: { campaignId: campaign.id, stepIndex: 0 } });
      const rejected = outcomes.filter(log => log.status === 'FAILED').length;
      const accepted = outcomes.filter(log => log.whatsappMessageId || log.status === 'SUCCESS').length;
      const confirmed = outcomes.filter(log => log.deliveredAt || log.readAt).length;
      await tx.campaign.update({ where: { id: campaign.id }, data: {
        status: outcomes.length > 0 && rejected === outcomes.length ? 'FAILED' : 'COMPLETED',
        estimatedReach: matchingCustomers.length, completedAt: new Date(), executedAt: campaign.executedAt ?? now,
        totalSent: accepted, totalDelivered: isWhatsApp ? confirmed : delivered, totalFailed: rejected,
      } });
    });

    // Mark queue item as COMPLETED instead of deleting (audit trail)
    await prisma.campaignQueueItem.update({
      where: { id: candidate.id },
      data: {
        status: sent === 0 && failed > 0 ? 'FAILED' : 'COMPLETED',
      },
    });

    // Usage tracking (best-effort)
    const period = currentPeriod();
    const usageUserId = 'store';
    await prisma.usageMetric.upsert({
      where: {
        storeId_period_userId: { storeId, period, userId: usageUserId },
      },
      create: {
        storeId,
        period,
        userId: usageUserId,
        planType: 'basic',
        messagesSent: sent,
        campaignsCreated: 1,
        apiCalls: 0,
        messagesLimit: -1,
        campaignsLimit: -1,
        apiCallsLimit: -1,
      },
      update: {
        messagesSent: { increment: sent },
        campaignsCreated: { increment: 1 },
      },
    }).catch(() => {
      // Non-fatal: usage tracking best-effort
    });

    return { processed: 1, campaignId: campaign.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const retryCount = (candidate.retryCount ?? 0) + 1;
    // Never replay a whole batch: some recipients may already have been accepted.
    const maxRetries = 1;
    await prisma.campaignLog.create({ data: { campaignId: campaign.id, customerId: 'campaign', status: 'FAILED', error: errorIssues(e)[0].message, metadata: JSON.parse(JSON.stringify({ issues: errorIssues(e), scope: 'campaign' })) } });

    if (retryCount >= maxRetries) {
      await prisma.campaignQueueItem.update({
        where: { id: candidate.id },
        data: { status: 'FAILED', lastError: message, retryCount },
      });
      // Reflect the failure on the campaign itself so the user sees FAILED
      // instead of a campaign stuck on RUNNING with no explanation.
      await prisma.campaign
        .update({ where: { id: candidate.campaignId }, data: { status: 'FAILED' } })
        .catch(() => {});
      await logError({
        message: `Campaign ${candidate.campaignId} failed after ${maxRetries} retries`,
        stack: e instanceof Error ? e.stack : undefined,
        context: { campaignId: candidate.campaignId },
      });
    } else {
      const delayMs = 60000 * retryCount;
      await prisma.campaignQueueItem.update({
        where: { id: candidate.id },
        data: {
          status: 'PENDING',
          retryCount,
          lastError: message,
          lastAttempt: now,
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });
    }
    return { processed: 0, campaignId: candidate.campaignId, error: message };
  }
}
