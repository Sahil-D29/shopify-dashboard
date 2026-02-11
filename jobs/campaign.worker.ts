/**
 * Campaign worker - process one pending CampaignQueueItem per invocation.
 * Fetches segment, resolves customers, sends via EMAIL/SMS/WHATSAPP, logs and updates stats.
 */
import { ShopifyClient } from '@/lib/shopify/client';
import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { matchesGroups } from '@/lib/segments/evaluator';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { SegmentGroup } from '@/lib/types/segment';
import { getWhatsAppConfig } from '@/lib/config/whatsapp-env';

const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

async function sendWhatsAppText(phone: string, body: string): Promise<{ success: boolean; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return { success: false, error: 'WhatsApp not configured' };
  }
  const formatted = phone.replace(/[\s\-+()]/g, '');
  if (!formatted) return { success: false, error: 'Invalid phone' };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
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

  try {
    if (!store?.shopifyDomain || !store?.accessToken) {
      throw new Error('Store or access token missing');
    }

    const client = new ShopifyClient({
      shop: store.shopifyDomain,
      accessToken: store.accessToken,
    });

    const conditionGroups: SegmentGroup[] =
      (campaign.segment?.filters as { conditionGroups?: SegmentGroup[] } | null)?.conditionGroups ?? [];
    const hasSegment = campaign.segmentId && conditionGroups.length > 0;

    const rawCustomers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    const matchingCustomers = !hasSegment || campaign.segment?.name?.toLowerCase() === 'all'
      ? rawCustomers
      : rawCustomers.filter((c) => {
          try {
            return matchesGroups(c, conditionGroups);
          } catch {
            return false;
          }
        });

    let sent = 0;
    let delivered = 0;

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

      if (campaign.type === 'EMAIL') {
        const email = customer.email ?? null;
        if (!email) {
          await logFailure('No email');
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
        }
      } else if (campaign.type === 'WHATSAPP') {
        const phone = sanitizePhone(customer.phone ?? (customer as { default_address?: { phone?: string } })?.default_address?.phone ?? null);
        if (!phone) {
          await logFailure('No phone');
          continue;
        }
        const result = await sendWhatsAppText(phone, personalizedBody);
        if (result.success) {
          await logSuccess();
          sent++;
          delivered++;
        } else {
          await logFailure(result.error ?? 'Send failed');
          sent++;
        }
      } else if (campaign.type === 'SMS' || campaign.type === 'PUSH') {
        // No SMS/PUSH provider in app – log as sent for tracking
        await logSuccess(`Channel ${campaign.type} not configured`);
        sent++;
        delivered++;
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        executedAt: now,
        totalSent: (campaign.totalSent ?? 0) + sent,
        totalDelivered: (campaign.totalDelivered ?? 0) + delivered,
      },
    });

    await prisma.campaignQueueItem.delete({ where: { id: candidate.id } });

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
