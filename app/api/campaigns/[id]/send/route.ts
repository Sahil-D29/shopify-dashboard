export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
import { calculateBestSendTime } from '@/lib/utils/bestTime';

export const runtime = 'nodejs';

interface CampaignMessage {
  messageId: string;
  campaignId: string;
  customerId: string;
  customerPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface FailedMessage {
  customerId: string;
  error: string;
}

interface ScheduledMessage {
  customerId: string;
  scheduledFor: number;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const loadCampaigns = (): Campaign[] => readJsonFile<Campaign>('campaigns.json');
const loadSegments = (): CustomerSegment[] => readJsonFile<CustomerSegment>('segments.json');
const loadCampaignMessages = (): CampaignMessage[] => readJsonFile<CampaignMessage>('campaign-messages.json');

const saveCampaigns = (campaigns: Campaign[]): void => writeJsonFile('campaigns.json', campaigns);
const saveCampaignMessages = (messages: CampaignMessage[]): void => writeJsonFile('campaign-messages.json', messages);

const generateId = (prefix: string, uniqueSeed: string | number): string =>
  `${prefix}_${Date.now()}_${uniqueSeed}`;

const sanitizePhoneNumber = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const digits = value.replace(/[\s\-+()]/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) return null;
  return digits;
};

const personalizeMessageBody = (body: string, customer: ShopifyCustomer): string => {
  const firstName = customer.first_name ?? 'Customer';
  const lastName = customer.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Customer';

  return body
    .replace(/\{\{name\}\}/g, fullName)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{last_name\}\}/g, lastName)
    .replace(/\{\{email\}\}/g, customer.email ?? '');
};

const matchesSegments = (customer: ShopifyCustomer, segments: CustomerSegment[]): boolean =>
  segments.every(segment => matchesGroups(customer, segment.conditionGroups ?? []));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: campaignId } = await params;

    const campaigns = loadCampaigns();
    const campaignIndex = campaigns.findIndex(campaign => campaign.id === campaignId);

    if (campaignIndex === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[campaignIndex];
    const whatsappValidation = validateWhatsAppConfig();
    if (!whatsappValidation.valid) {
      return NextResponse.json(
        { error: 'WhatsApp not configured', details: whatsappValidation.error },
        { status: 400 },
      );
    }

    const whatsappConfig = whatsappValidation.config;
    const segments = loadSegments();
    const selectedSegments = segments.filter(segment => campaign.segmentIds.includes(segment.id));

    const client = getShopifyClient(request);
    const shopifyCustomers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });
    const matchingCustomers = selectedSegments.length
      ? shopifyCustomers.filter(customer => matchesSegments(customer, selectedSegments))
      : shopifyCustomers;

    campaigns[campaignIndex] = {
      ...campaign,
      status: 'RUNNING',
      startedAt: campaign.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    saveCampaigns(campaigns);

    const campaignMessages = loadCampaignMessages();
    const sentMessages: string[] = [];
    const failedMessages: FailedMessage[] = [];
    const scheduledMessages: ScheduledMessage[] = [];

    for (const customer of matchingCustomers) {
      const phone = sanitizePhoneNumber(customer.phone ?? customer.default_address?.phone ?? null);
      if (!phone) {
        continue;
      }

      if (campaign.useSmartTiming) {
        try {
          const bestTime = await calculateBestSendTime(String(customer.id), client);
          const now = new Date();
          const scheduledDate = new Date();
          scheduledDate.setHours(bestTime.hour, 0, 0, 0);

          if (scheduledDate <= now) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
          }

          scheduledMessages.push({
            customerId: String(customer.id),
            scheduledFor: scheduledDate.getTime(),
          });
          continue;
        } catch (error) {
          console.error(`[API] Error calculating best time for customer ${customer.id}:`, error);
        }
      }

      try {
        const messageBody = personalizeMessageBody(campaign.messageContent.body ?? '', customer);
        const payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: messageBody },
        };

        const apiUrl = `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}/messages`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsappConfig.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const json = (await response.json()) as { messages?: Array<{ id: string }>; error?: { code?: unknown; message?: string } };

        if (response.ok && json.messages?.[0]?.id) {
          const messageId = json.messages[0].id;
          sentMessages.push(messageId);

          campaignMessages.push({
            messageId,
            campaignId,
            customerId: String(customer.id),
            customerPhone: phone,
            status: 'sent',
            sentAt: new Date().toISOString(),
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            errorCode: null,
            errorMessage: null,
          });
        } else {
          const errorCode = json.error?.code?.toString() ?? 'UNKNOWN';
          const errorMessage = json.error?.message ?? 'Failed to send message';
          const failureId = generateId('failed', customer.id);

          campaignMessages.push({
            messageId: failureId,
            campaignId,
            customerId: String(customer.id),
            customerPhone: phone,
            status: 'failed',
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            failedAt: new Date().toISOString(),
            errorCode,
            errorMessage,
          });
          failedMessages.push({ customerId: String(customer.id), error: errorMessage });
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        failedMessages.push({ customerId: String(customer.id), error: errorMessage });
      }
    }

    saveCampaignMessages(campaignMessages);

    campaigns[campaignIndex] = {
      ...campaigns[campaignIndex],
      metrics: {
        ...campaigns[campaignIndex].metrics,
        sent: campaigns[campaignIndex].metrics.sent + sentMessages.length,
        failed: campaigns[campaignIndex].metrics.failed + failedMessages.length,
      },
      updatedAt: Date.now(),
    };
    saveCampaigns(campaigns);

    return NextResponse.json({
      campaign: campaigns[campaignIndex],
      success: true,
      message: campaign.useSmartTiming
        ? `Campaign launched successfully. ${scheduledMessages.length} messages scheduled for optimal send times.`
        : 'Campaign launched successfully',
      stats: {
        sent: sentMessages.length,
        failed: failedMessages.length,
        scheduled: scheduledMessages.length,
        total: matchingCustomers.length,
      },
    });
  } catch (error) {
    console.error('[API] Error launching campaign:', error);
    return NextResponse.json(
      {
        error: 'Failed to launch campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

