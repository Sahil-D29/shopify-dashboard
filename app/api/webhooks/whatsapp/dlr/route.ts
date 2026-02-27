export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { prisma } from '@/lib/prisma';
import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';

interface DLRPayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        statuses: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
          }>;
        }>;
      };
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DLRPayload;

    // Process each status update
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const status of change.value?.statuses || []) {
          const { id: messageId, status: messageStatus, recipient_id, timestamp, errors } = status;

          // ─── Update Prisma Message status ────────
          try {
            const statusMap: Record<string, string> = {
              sent: 'SENT',
              delivered: 'DELIVERED',
              read: 'READ',
              failed: 'FAILED',
            };
            const prismaStatus = statusMap[messageStatus];
            if (prismaStatus && messageId) {
              await prisma.message.updateMany({
                where: { whatsappMessageId: messageId },
                data: {
                  status: prismaStatus as any,
                  errorMessage: messageStatus === 'failed' ? errors?.[0]?.message || 'Delivery failed' : undefined,
                },
              });
            }
          } catch (err) {
            console.error('[DLR] Prisma message update error:', err);
          }

          // ─── Update CampaignLog + Campaign metrics ────────
          try {
            if (messageId) {
              const campaignLog = await prisma.campaignLog.findFirst({
                where: { whatsappMessageId: messageId },
              });

              if (campaignLog) {
                const logUpdates: Record<string, unknown> = {};

                if (messageStatus === 'delivered') {
                  logUpdates.status = 'DELIVERED';
                  logUpdates.deliveredAt = new Date();
                } else if (messageStatus === 'read') {
                  logUpdates.status = 'READ';
                  logUpdates.readAt = new Date();
                  // Reset 24hr free messaging window — customer engaged
                  logUpdates.windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                } else if (messageStatus === 'failed') {
                  logUpdates.status = 'FAILED';
                  logUpdates.error = errors?.[0]?.message || 'Delivery failed';
                }

                if (Object.keys(logUpdates).length > 0) {
                  await prisma.campaignLog.update({
                    where: { id: campaignLog.id },
                    data: logUpdates as any,
                  });
                }

                // Update campaign-level aggregate metrics
                if (messageStatus === 'delivered') {
                  await prisma.campaign.update({
                    where: { id: campaignLog.campaignId },
                    data: { totalDelivered: { increment: 1 } },
                  });
                } else if (messageStatus === 'read') {
                  await prisma.campaign.update({
                    where: { id: campaignLog.campaignId },
                    data: { totalOpened: { increment: 1 } },
                  });
                } else if (messageStatus === 'failed') {
                  await prisma.campaign.update({
                    where: { id: campaignLog.campaignId },
                    data: { totalFailed: { increment: 1 } },
                  });
                }
              }
            }
          } catch (err) {
            console.error('[DLR] CampaignLog update error:', err);
            // Non-fatal: don't break webhook processing
          }

          // Find journey enrollment with this message ID
          const enrollments = readJsonFile<any>('journey-enrollments.json');
          const enrollment = enrollments.find((e: any) => 
            e.metadata?.whatsappMessageId === messageId
          ) as any;

          if (!enrollment) {
            console.warn(`[DLR] No enrollment found for message ${messageId}`);
            continue;
          }

          // Load journey to find WhatsApp node
          const journeys = readJsonFile<JourneyDefinition>('journeys.json');
          const journey = journeys.find((j: JourneyDefinition) => j.id === enrollment.journeyId);
          if (!journey) continue;

          const node = journey.nodes.find((n: JourneyNode) => 
            n.id === enrollment.currentNodeId && 
            n.type === 'action' && (n.data as any)?.meta?.actionType === 'whatsapp'
          );
          if (!node) continue;

          const exitPaths = (node as any).config?.exitPaths;
          if (!exitPaths) continue;

          // Route user based on exit path configuration
          switch (messageStatus) {
            case 'sent':
              if (exitPaths.sent?.enabled && exitPaths.sent.action.type === 'branch') {
                await routeUserToBranch(enrollment, exitPaths.sent.action.branchId, journey);
              }
              break;

            case 'delivered':
              if (exitPaths.delivered?.enabled) {
                // Track event
                if (exitPaths.delivered.tracking?.enabled) {
                  await trackEvent(enrollment, exitPaths.delivered.tracking.eventName, {
                    messageId,
                    status: 'delivered',
                    timestamp,
                  });
                }
                // Route
                if (exitPaths.delivered.action.type === 'branch') {
                  await routeUserToBranch(enrollment, exitPaths.delivered.action.branchId, journey);
                }
              }
              break;

            case 'read':
              if (exitPaths.read?.enabled) {
                // Track event
                if (exitPaths.read.tracking?.enabled) {
                  await trackEvent(enrollment, exitPaths.read.tracking.eventName, {
                    messageId,
                    status: 'read',
                    timestamp,
                  });
                }
                // Route
                if (exitPaths.read.action.type === 'wait') {
                  // Set up timeout
                  const timeoutMs = (exitPaths.read.action.waitDuration || 60) * 60 * 1000;
                  enrollment.waitingForEvent = {
                    type: 'whatsapp_read',
                    timeoutAt: new Date(Date.now() + timeoutMs).toISOString(),
                  };
                  if (exitPaths.read.action.timeoutPath) {
                    enrollment.metadata = {
                      ...enrollment.metadata,
                      timeoutPath: exitPaths.read.action.timeoutPath,
                    };
                  }
                } else if (exitPaths.read.action.type === 'branch') {
                  await routeUserToBranch(enrollment, exitPaths.read.action.branchId, journey);
                }
              }
              break;

            case 'failed':
              if (exitPaths.failed?.enabled) {
                // Track event
                if (exitPaths.failed.tracking?.enabled) {
                  await trackEvent(enrollment, exitPaths.failed.tracking.eventName, {
                    messageId,
                    status: 'failed',
                    errors,
                    timestamp,
                  });
                }
                // Route
                if (exitPaths.failed.action.type === 'branch') {
                  await routeUserToBranch(enrollment, exitPaths.failed.action.branchId, journey);
                } else if (exitPaths.failed.action.type === 'exit') {
                  enrollment.status = 'exited';
                  enrollment.completedAt = new Date().toISOString();
                }
              }
              break;
          }

          // Update enrollment
          const enrollmentIndex = enrollments.findIndex(e => e.id === enrollment.id);
          if (enrollmentIndex >= 0) {
            enrollments[enrollmentIndex] = enrollment;
            writeJsonFile('journey-enrollments.json', enrollments);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DLR webhook]', error);
    return NextResponse.json(
      { error: 'Failed to process DLR' },
      { status: 500 }
    );
  }
}

async function routeUserToBranch(
  enrollment: any,
  branchId: string,
  journey: JourneyDefinition
) {
  // Find target node for this branch
  const targetNode = journey.nodes.find(n => 
    n.id === branchId || (n as any).metadata?.branchId === branchId
  );

  if (targetNode) {
    enrollment.currentNodeId = targetNode.id;
    enrollment.lastActivityAt = new Date().toISOString();
    
    // Log activity
    const activities = readJsonFile<any>('journey-activity-log.json');
    activities.push({
      id: `activity_${Date.now()}`,
      enrollmentId: enrollment.id,
      journeyId: journey.id,
      nodeId: targetNode.id,
      action: 'routed_to_branch',
      timestamp: new Date().toISOString(),
      metadata: { branchId },
    });
    writeJsonFile('journey-activity-log.json', activities);
  }
}

async function trackEvent(enrollment: any, eventName: string, properties: Record<string, any>) {
  // In production, this would call your analytics service
  console.log(`[Event Tracking] ${eventName}`, {
    customerId: enrollment.customerId,
    journeyId: enrollment.journeyId,
    properties,
  });
}

