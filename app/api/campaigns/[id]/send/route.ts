export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prepareTemplate } from '@/lib/whatsapp/template-send';
import { campaignTemplateInput } from '@/lib/whatsapp/campaign-config';
import { errorIssues } from '@/lib/whatsapp/issues';
import { runCampaignWorkerStep } from '@/jobs/campaign.worker';
import { transformCampaign } from '@/lib/utils/db-transformers';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({ where: { id, storeId } });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft campaigns can be launched. Duplicate this campaign to send again.' }, { status: 409 });
    await prepareTemplate(storeId, campaignTemplateInput(campaign), {}, true);
    await prisma.$transaction(async tx => {
      const claimed = await tx.campaign.updateMany({ where: { id, storeId, status: 'DRAFT' }, data: { status: 'RUNNING', executedAt: new Date() } });
      if (!claimed.count) throw new Error('Campaign has already been launched');
      await tx.campaignQueueItem.create({ data: { campaignId: id, storeId, status: 'PENDING', scheduledAt: new Date() } });
    });
    await runCampaignWorkerStep(id);
    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ campaign: transformCampaign(updated as any), success: updated.status !== 'FAILED', message: updated.status === 'FAILED' ? 'Campaign failed. Open Issues for details.' : 'Campaign processed. Check delivery status for results.' });
  } catch (error) {
    const issues = errorIssues(error);
    return NextResponse.json({ success: false, error: issues[0].message, issues }, { status: 422 });
  }
}
