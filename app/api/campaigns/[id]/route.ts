import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prepareTemplate } from '@/lib/whatsapp/template-send';
import { campaignTemplateInput } from '@/lib/whatsapp/campaign-config';
import { errorIssues } from '@/lib/whatsapp/issues';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { prisma } from '@/lib/prisma';
import { transformCampaign } from '@/lib/utils/db-transformers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const { id } = await params;
    const dbCampaign = await prisma.campaign.findFirst({
      where: { id, storeId },
      include: {
        segment: true,
        store: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        followUps: {
          where: { isActive: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!dbCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = transformCampaign(dbCampaign);

    // Attach follow-up steps to response
    const followUpSteps = dbCampaign.followUps.map((fu) => ({
      id: fu.id,
      stepIndex: fu.stepIndex,
      name: fu.name,
      condition: fu.condition,
      delayMinutes: fu.delayMinutes,
      messageBody: fu.messageBody,
      templateName: fu.templateName,
      useSmartWindow: fu.useSmartWindow,
      totalSent: fu.totalSent,
      totalDelivered: fu.totalDelivered,
      totalRead: fu.totalRead,
      totalFreeForm: fu.totalFreeForm,
    }));

    return NextResponse.json({ campaign, followUpSteps });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const { id } = await params;
    let updates: Partial<Campaign>;
    try {
      updates = (await request.json()) as Partial<Campaign>;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const existingCampaign = await prisma.campaign.findFirst({ where: { id, storeId } });
    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (['RUNNING', 'COMPLETED'].includes(existingCampaign.status)) return NextResponse.json({ error: 'Duplicate a running or completed campaign to change its content.' }, { status: 409 });
    if (existingCampaign.status === 'FAILED' && await prisma.campaignLog.count({ where: { campaignId: id, whatsappMessageId: { not: null } } })) return NextResponse.json({ error: 'This campaign has accepted messages. Duplicate it to send again.' }, { status: 409 });
    if (updates.status === 'RUNNING' || updates.status === 'COMPLETED') return NextResponse.json({ error: 'Use the campaign launch action to send a draft.' }, { status: 409 });
    if (updates.status === 'SCHEDULED' || (updates.status !== 'DRAFT' && existingCampaign.status === 'SCHEDULED')) {
      try { await prepareTemplate(storeId, campaignTemplateInput({ ...existingCampaign, ...updates }), {}, true); }
      catch (error) { const issues = errorIssues(error); return NextResponse.json({ error: issues[0].message, issues }, { status: 422 }); }
    }
    // Transform updates to database format
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
    }
    if (updates.segmentIds) {
      dbUpdates.segmentId = updates.segmentIds[0] ?? null;
    }
    if (updates.messageContent !== undefined && updates.messageContent !== null) {
      dbUpdates.messageTemplate = {
        messageContent: updates.messageContent,
        body: updates.messageContent?.body,
        subject: updates.messageContent?.subject,
        media: updates.messageContent?.media,
        buttons: updates.messageContent?.buttons,
        variables: updates.messageContent?.variables,
      };
    }
    if (updates.scheduledAt !== undefined) {
      dbUpdates.scheduledAt = updates.scheduledAt ? new Date(updates.scheduledAt) : null;
    }
    for (const field of ['whatsappConfig', 'templateId', 'segmentIds', 'sendingSpeed', 'scheduleType', 'timezone']) {
      if ((updates as any)[field] !== undefined) dbUpdates[field] = (updates as any)[field];
    }
    const dbCampaign = await prisma.campaign.update({
      where: { id, storeId },
      data: dbUpdates,
      include: {
        segment: true,
        store: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (dbCampaign.status === 'SCHEDULED') {
      const scheduledAt = dbCampaign.scheduledAt ?? new Date();
      const queued = await prisma.campaignQueueItem.updateMany({ where: { campaignId: id, storeId, status: 'PENDING' }, data: { scheduledAt } });
      if (!queued.count) await prisma.campaignQueueItem.create({ data: { campaignId: id, storeId, status: 'PENDING', scheduledAt } });
    } else if (dbCampaign.status === 'DRAFT') {
      await prisma.campaignQueueItem.updateMany({ where: { campaignId: id, storeId, status: 'PENDING' }, data: { status: 'FAILED', lastError: 'Schedule cancelled: campaign saved as draft.' } });
    }
    // Sync follow-up steps if provided
    const followUpSteps = (updates as any).followUpSteps as
      | Array<{
          id?: string;
          stepIndex: number;
          name: string;
          condition: string;
          delayMinutes: number;
          messageBody: string;
          templateName?: string;
          useSmartWindow?: boolean;
        }>
      | undefined;

    if (followUpSteps !== undefined) {
      // Delete existing follow-ups and recreate
      await prisma.campaignFollowUp.deleteMany({
        where: { campaignId: id },
      });

      if (followUpSteps.length > 0) {
        await prisma.campaignFollowUp.createMany({
          data: followUpSteps.map((step) => ({
            campaignId: id,
            stepIndex: step.stepIndex,
            name: step.name,
            condition: step.condition,
            delayMinutes: step.delayMinutes,
            messageBody: step.messageBody,
            templateName: step.templateName ?? null,
            useSmartWindow: step.useSmartWindow ?? true,
            isActive: true,
          })),
        });
      }
    }

    const campaign = transformCampaign(dbCampaign);
    return NextResponse.json({ campaign, success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to update campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const { id } = await params;
    
    const existingCampaign = await prisma.campaign.findFirst({ where: { id, storeId } });
    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await prisma.campaign.delete({ where: { id, storeId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to delete campaign',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

