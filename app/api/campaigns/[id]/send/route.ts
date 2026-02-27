export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { prisma } from '@/lib/prisma';
import { transformCampaign } from '@/lib/utils/db-transformers';
import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { matchesGroups } from '@/lib/segments/evaluator';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const storeId = await getCurrentStoreId(request);

    // Load campaign from Prisma
    const dbCampaign = await prisma.campaign.findFirst({
      where: { id: campaignId, storeId: storeId || undefined },
      include: { segment: true, store: true, creator: { select: { id: true, name: true, email: true } } },
    });

    if (!dbCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = transformCampaign(dbCampaign);

    // Validate WhatsApp config
    const whatsappValidation = validateWhatsAppConfig();
    if (!whatsappValidation.valid) {
      return NextResponse.json(
        { error: 'WhatsApp not configured', details: whatsappValidation.error },
        { status: 400 },
      );
    }

    const whatsappConfig = whatsappValidation.config;

    // Load segments from Prisma
    const selectedSegments = campaign.segmentIds.length > 0
      ? await prisma.segment.findMany({ where: { id: { in: campaign.segmentIds } } })
      : [];

    // Fetch customers from Shopify
    const client = getShopifyClient(request);
    const shopifyCustomers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });

    // Filter by segments
    const matchingCustomers = selectedSegments.length > 0
      ? shopifyCustomers.filter((customer) =>
          selectedSegments.every((segment) => {
            const conditionGroups = (segment.filters as any)?.conditionGroups || [];
            return matchesGroups(customer, conditionGroups);
          }),
        )
      : shopifyCustomers;

    // Update campaign status to RUNNING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        executedAt: dbCampaign.executedAt ?? new Date(),
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const customer of matchingCustomers) {
      const phone = sanitizePhoneNumber(
        customer.phone ?? customer.default_address?.phone ?? null,
      );
      if (!phone) continue;

      try {
        const messageBody = personalizeMessageBody(
          campaign.messageContent.body ?? '',
          customer,
        );
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

        const json = (await response.json()) as {
          messages?: Array<{ id: string }>;
          error?: { code?: unknown; message?: string };
        };

        if (response.ok && json.messages?.[0]?.id) {
          sentCount++;
          const waMessageId = json.messages[0].id;
          // Log success to Prisma with follow-up tracking fields
          await prisma.campaignLog.create({
            data: {
              campaignId,
              customerId: String(customer.id),
              status: 'SUCCESS',
              message: waMessageId,
              whatsappMessageId: waMessageId,
              stepIndex: 0,
              windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              metadata: { phone, messageBody: messageBody.slice(0, 200) },
            },
          });
        } else {
          failedCount++;
          const errorMessage = json.error?.message ?? 'Failed to send message';
          await prisma.campaignLog.create({
            data: {
              campaignId,
              customerId: String(customer.id),
              status: 'FAILED',
              error: errorMessage,
              metadata: { phone, errorCode: String(json.error?.code ?? '') },
            },
          });
        }
      } catch (error) {
        failedCount++;
        await prisma.campaignLog.create({
          data: {
            campaignId,
            customerId: String(customer.id),
            status: 'FAILED',
            error: getErrorMessage(error),
            metadata: { phone },
          },
        });
      }
    }

    // Update campaign metrics in Prisma
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        totalSent: { increment: sentCount },
        totalFailed: { increment: failedCount },
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: { segment: true, store: true, creator: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      campaign: transformCampaign(updatedCampaign),
      success: true,
      message: 'Campaign launched successfully',
      stats: {
        sent: sentCount,
        failed: failedCount,
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
