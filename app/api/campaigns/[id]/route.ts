export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import type { Campaign } from '@/lib/types/campaign';
import { prisma } from '@/lib/prisma';
import { transformCampaign } from '@/lib/utils/db-transformers';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id },
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
    
    const existingCampaign = await prisma.campaign.findUnique({ where: { id } });
    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Transform updates to database format
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status === 'RUNNING' ? 'RUNNING' : 
                         updates.status === 'SCHEDULED' ? 'SCHEDULED' : 
                         updates.status === 'COMPLETED' ? 'COMPLETED' : 
                         updates.status === 'FAILED' ? 'FAILED' : 'DRAFT';
    }
    if (updates.segmentIds && updates.segmentIds.length > 0) {
      dbUpdates.segmentId = updates.segmentIds[0];
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
    if (updates.metrics !== undefined && updates.metrics !== null) {
      dbUpdates.totalSent = updates.metrics?.sent || 0;
      dbUpdates.totalDelivered = updates.metrics?.delivered || 0;
      dbUpdates.totalOpened = updates.metrics?.opened || 0;
      dbUpdates.totalClicked = updates.metrics?.clicked || 0;
    }

    const dbCampaign = await prisma.campaign.update({
      where: { id },
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existingCampaign = await prisma.campaign.findUnique({ where: { id } });
    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await prisma.campaign.delete({ where: { id } });
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

