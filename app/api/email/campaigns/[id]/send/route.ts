export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { sendCampaignNow } from '@/lib/email/send-campaign';
import { isResendConfigured } from '@/lib/email/resend';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email sending is not configured. Set RESEND_API_KEY in your environment variables.',
        },
        { status: 400 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (!storeFilter.allowAll && campaign.storeId !== storeFilter.storeId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (campaign.status === 'SENDING') {
      return NextResponse.json(
        { error: 'Campaign is already sending' },
        { status: 400 },
      );
    }
    if (campaign.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Campaign has already been sent' },
        { status: 400 },
      );
    }

    // Verified domain check: from-email's domain must match a VERIFIED EmailDomain
    const fromDomain = campaign.fromEmail.split('@')[1];
    const verifiedDomain = await prisma.emailDomain.findFirst({
      where: {
        storeId: campaign.storeId,
        status: 'VERIFIED',
        name: { equals: fromDomain, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!verifiedDomain) {
      return NextResponse.json(
        {
          error: `Cannot send from "${campaign.fromEmail}" — the domain "${fromDomain}" is not verified. Add and verify it in Sending Domains first.`,
        },
        { status: 400 },
      );
    }

    const result = await sendCampaignNow(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Email Campaigns][SEND] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
