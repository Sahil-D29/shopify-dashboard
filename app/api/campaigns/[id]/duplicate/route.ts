export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { transformCampaign } from '@/lib/utils/db-transformers';
import { randomUUID } from 'crypto';

/** Safely convert a Prisma JsonValue for nullable Json fields */
const jsonOrNull = (val: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  val != null ? (val as Prisma.InputJsonValue) : Prisma.JsonNull;

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const storeId = await getCurrentStoreId(request);

    // Find the original campaign
    const original = await prisma.campaign.findFirst({
      where: { id, storeId: storeId || undefined },
      include: { segment: true, store: true, creator: { select: { id: true, name: true, email: true } } },
    });

    if (!original) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Create duplicate with reset metrics
    const duplicate = await prisma.campaign.create({
      data: {
        id: `camp_${randomUUID()}`,
        storeId: original.storeId,
        name: `${original.name} (Copy)`,
        description: original.description,
        type: original.type,
        status: 'DRAFT',
        segmentId: original.segmentId,
        segmentIds: original.segmentIds ?? [],
        messageTemplate: jsonOrNull(original.messageTemplate),
        scheduleType: original.scheduleType,
        scheduledAt: null,
        executedAt: null,
        completedAt: null,
        // Audience & Delivery
        estimatedReach: original.estimatedReach ?? 0,
        sendingSpeed: original.sendingSpeed ?? 'MEDIUM',
        timezone: original.timezone ?? 'Asia/Kolkata',
        useSmartTiming: original.useSmartTiming ?? false,
        templateId: original.templateId ?? null,
        // Labels & Tags
        tags: original.tags ?? [],
        labels: original.labels ?? [],
        // Advanced config (copy as-is)
        whatsappConfig: jsonOrNull(original.whatsappConfig),
        abTestConfig: jsonOrNull(original.abTestConfig),
        dripSteps: jsonOrNull(original.dripSteps),
        triggerEvent: original.triggerEvent ?? null,
        triggerDelay: original.triggerDelay ?? null,
        triggerConditions: jsonOrNull(original.triggerConditions),
        goalTracking: jsonOrNull(original.goalTracking),
        recurringConfig: jsonOrNull(original.recurringConfig),
        // Reset all metrics
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalFailed: 0,
        totalConverted: 0,
        totalUnsubscribed: 0,
        totalRevenue: 0,
        createdBy: original.createdBy,
      },
      include: { segment: true, store: true, creator: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ campaign: transformCampaign(duplicate), success: true });
  } catch (error) {
    console.error('[API] Error duplicating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate campaign', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
