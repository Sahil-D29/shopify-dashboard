export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { readJsonFile } from '@/lib/utils/json-storage';

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

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const filterByCampaign = (messages: CampaignMessage[], campaignId: string): CampaignMessage[] =>
  messages.filter(message => message.campaignId === campaignId);

const countWhere = <T>(items: T[], predicate: (item: T) => boolean): number =>
  items.reduce((total, item) => (predicate(item) ? total + 1 : total), 0);

const toTwoDecimal = (value: number): number => Math.round(value * 100) / 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: campaignId } = await params;

    const campaigns = readJsonFile<Campaign>('campaigns.json');
    const campaign = campaigns.find(current => current.id === campaignId);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const messages = readJsonFile<CampaignMessage>('campaign-messages.json');
    const campaignMessages = filterByCampaign(messages, campaignId);

    const toSend = campaign.estimatedReach ?? 0;
    const sent = countWhere(campaignMessages, message =>
      message.status === 'sent' || message.status === 'delivered' || message.status === 'read',
    );
    const delivered = countWhere(campaignMessages, message =>
      message.status === 'delivered' || message.status === 'read',
    );
    const read = countWhere(campaignMessages, message => message.status === 'read');
    const failed = countWhere(campaignMessages, message => message.status === 'failed');

    const sentRate = toSend > 0 ? (sent / toSend) * 100 : 0;
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
    const readRate = delivered > 0 ? (read / delivered) * 100 : 0;

    return NextResponse.json({
      toSend,
      sent,
      delivered,
      read,
      failed,
      sentRate: toTwoDecimal(sentRate),
      deliveryRate: toTwoDecimal(deliveryRate),
      readRate: toTwoDecimal(readRate),
    });
  } catch (error) {
    console.error('[API] Error fetching message stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message stats', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

