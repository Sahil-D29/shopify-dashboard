/**
 * Campaign worker - process one pending CampaignQueueItem per invocation.
 * Supports multi-segment targeting, sending speed rate-limiting, and preserves
 * queue items for audit trail instead of deleting them.
 */
import { ShopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/prisma';
import { graphUrl } from '@/lib/whatsapp/graph';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { SegmentGroup } from '@/lib/types/segment';
import { META_GRAPH_API_VERSION } from '@/lib/config/whatsapp-config-resolver';

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

function sanitizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[\s\-+()]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return null;
  return digits;
}

async function sendWhatsAppText(phone: string, body: string, storeId: string): Promise<{ success: boolean; error?: string }> {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { storeId },
  });
  if (!config?.phoneNumberId || !config?.accessToken) {
    return { success: false, error: 'WhatsApp not configured' };
  }
  const formatted = phone.replace(/[\s\-+()]/g, '');
  if (!formatted) return { success: false, error: 'Invalid phone' };

  // Embedded Signup tokens are stored encrypted — decrypt before use.
  let accessToken = config.accessToken;
  try {
    const { isEncrypted, decrypt } = await import('@/lib/encryption');
    if (isEncrypted(accessToken)) accessToken = decrypt(accessToken);
  } catch {
    // use as-is
  }

  try {
    const res = await fetch(
      graphUrl(`${META_GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, accessToken),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formatted,
          type: 'text',
          text: { preview_url: false, body },
        }),
      },
    );
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (res.ok && data.messages?.[0]?.id) return { success: true };
    return { success: false, error: data.error?.message ?? 'Send failed' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  language: string,
  storeId: string,
): Promise<{ success: boolean; error?: string }> {
  const config = await prisma.whatsAppConfig.findUnique({ where: { storeId } });
  if (!config?.phoneNumberId || !config?.accessToken) {
    return { success: false, error: 'WhatsApp not configured' };
  }
  const formatted = phone.replace(/[\s\-+()]/g, '');
  if (!formatted) return { success: false, error: 'Invalid phone' };

  let accessToken = config.accessToken;
  try {
    const { isEncrypted, decrypt } = await import('@/lib/encryption');
    if (isEncrypted(accessToken)) accessToken = decrypt(accessToken);
  } catch {
    // use as-is
  }

  try {
    const res = await fetch(
      graphUrl(`${META_GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, accessToken),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formatted,
          type: 'template',
          template: { name: templateName, language: { code: language || 'en' } },
        }),
      },
    );
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (res.ok && data.messages?.[0]?.id) return { success: true };
    return { success: false, error: data.error?.message ?? 'Send failed' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function runCampaignWorkerStep(): Promise<{ processed: number; campaignId?: string; error?: string }> {
  const now = new Date();
  const candidate = await prisma.campaignQueueItem.findFirst({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    include: { campaign: { include: { segment: true } }, store: true },
  });

  if (!candidate) {
    return { processed: 0 };
  }

  await prisma.campaignQueueItem.update({
    where: { id: candidate.id },
    data: { status: 'PROCESSING', startedAt: now },
  });

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

  // Prefer sending the approved WhatsApp template (required outside the 24h
  // session window). Falls back to free text only when no template was chosen.
  const waConfig = (campaign as { whatsappConfig?: { templateName?: string; templateLanguage?: string } | null }).whatsappConfig ?? null;
  const templateName = waConfig?.templateName ?? messageTemplate.templateName ?? '';
  const templateLanguage = waConfig?.templateLanguage ?? messageTemplate.language ?? 'en';

  // Rate-limiting delay based on sendingSpeed
  const sendingSpeed = (campaign as any).sendingSpeed ?? 'MEDIUM';
  const delayBetweenMessages = SPEED_DELAY_MS[sendingSpeed] ?? SPEED_DELAY_MS.MEDIUM;

  try {
    // Build a Shopify client best-effort. The audience engine below merges the
    // store's Contacts with Shopify customers and degrades gracefully when
    // Shopify is unavailable, so a WhatsApp-only store still resolves recipients.
    const client = new ShopifyClient({
      shop: store?.shopifyDomain ?? '',
      accessToken: store?.accessToken ?? '',
    });

    // Multi-segment support: use segmentIds array if available, fallback to single segmentId
    const segmentIds: string[] = (campaign as any).segmentIds ?? [];
    const allSegmentIds = segmentIds.length > 0
      ? segmentIds
      : campaign.segmentId
        ? [campaign.segmentId]
        : [];

    // Resolve the audience via the shared, Contact-aware engine (Contacts ⋃
    // Shopify customers, deduped). Recipients can come from any source — webhook
    // contacts, custom events, or Shopify — and the segment filters are applied
    // the same way the segment preview applies them.
    const { calculateSegmentStats } = await import('@/lib/utils/segment-stats');
    const segments = allSegmentIds.length > 0
      ? await prisma.segment.findMany({ where: { id: { in: allSegmentIds } } })
      : [];

    let matchingCustomers: ShopifyCustomer[];
    if (allSegmentIds.length === 0) {
      // No segment selected → whole audience (all contacts + customers).
      const stats = await calculateSegmentStats({ client, storeId, conditionGroups: [], forceRefresh: false });
      matchingCustomers = (stats.customers ?? []) as ShopifyCustomer[];
    } else {
      // Resolve each segment to its members, then intersect (a recipient must be
      // in ALL selected segments — matches the prior AND semantics).
      const pool = new Map<string, ShopifyCustomer>();
      let matchedIds: Set<string> | null = null;
      for (const segId of allSegmentIds) {
        const seg = segments.find(s => s.id === segId);
        const conditionGroups = (seg?.filters as { conditionGroups?: SegmentGroup[] } | null)?.conditionGroups ?? [];
        const stats = await calculateSegmentStats({ client, storeId, segmentId: segId, conditionGroups, forceRefresh: false });
        const members = (stats.customers ?? []) as ShopifyCustomer[];
        members.forEach(c => pool.set(String(c.id), c));
        const ids = new Set<string>(members.map(c => String(c.id)));
        if (matchedIds === null) {
          matchedIds = ids;
        } else {
          const prev: Set<string> = matchedIds;
          matchedIds = new Set<string>(Array.from(prev).filter(id => ids.has(id)));
        }
      }
      matchingCustomers = matchedIds ? Array.from(pool.values()).filter(c => matchedIds!.has(String(c.id))) : [];
    }

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
            windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      };
      const logFailure = async (err: string) => {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            customerId,
            status: 'FAILED',
            error: err,
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
          sent++;
          failed++;
        }
      } else if (campaignType === 'WHATSAPP' || campaignType === 'ONE_TIME' || campaignType === 'RECURRING' || campaignType === 'DRIP' || campaignType === 'TRIGGER_BASED') {
        // All new campaign types default to WhatsApp delivery
        const phone = sanitizePhone(
          customer.phone ?? (customer as { default_address?: { phone?: string } })?.default_address?.phone ?? null,
        );
        if (!phone) {
          await logFailure('No phone');
          failed++;
          continue;
        }
        const result = templateName
          ? await sendWhatsAppTemplate(phone, templateName, templateLanguage, storeId)
          : await sendWhatsAppText(phone, personalizedBody, storeId);
        if (result.success) {
          await logSuccess();
          sent++;
          delivered++;
        } else {
          await logFailure(result.error ?? 'Send failed');
          sent++;
          failed++;
        }
      } else if (campaignType === 'SMS' || campaignType === 'PUSH') {
        await logSuccess(`Channel ${campaignType} not configured`);
        sent++;
        delivered++;
      }

      // Rate-limiting delay between messages
      if (delayBetweenMessages > 0) {
        await sleep(delayBetweenMessages);
      }
    }

    // Update campaign metrics
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        executedAt: campaign.executedAt ?? now,
        totalSent: { increment: sent },
        totalDelivered: { increment: delivered },
        totalFailed: { increment: failed },
      },
    });

    // Mark queue item as COMPLETED instead of deleting (audit trail)
    await prisma.campaignQueueItem.update({
      where: { id: candidate.id },
      data: {
        status: 'COMPLETED',
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
    const maxRetries = parseInt(process.env.CAMPAIGN_RETRY_LIMIT ?? '3', 10);

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
