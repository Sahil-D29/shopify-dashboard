export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';

interface ButtonClickPayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messages: Array<{
          from: string;
          interactive: {
            type: 'button_reply' | 'list_reply';
            button_reply?: {
              id: string;
              title: string;
            };
            list_reply?: {
              id: string;
              title: string;
            };
          };
          context: {
            from: string;
            id: string; // Original message ID
          };
        }>;
      };
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ButtonClickPayload;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const message of change.value?.messages || []) {
          const { from: phoneNumber, interactive, context } = message;
          const buttonId = interactive.button_reply?.id || interactive.list_reply?.id;
          const buttonText = interactive.button_reply?.title || interactive.list_reply?.title;

          if (!buttonId || !context.id) continue;

          // Find enrollment by original message ID
          const enrollments = readJsonFile<any>('journey-enrollments.json');
          const enrollment = enrollments.find((e: any) => 
            e.metadata?.whatsappMessageId === context.id
          ) as any;

          if (!enrollment) {
            console.warn(`[Button Click] No enrollment found for message ${context.id}`);
            continue;
          }

          // Load journey and node
          const journeys = readJsonFile<JourneyDefinition>('journeys.json');
          const journey = journeys.find((j: JourneyDefinition) => j.id === enrollment.journeyId);
          if (!journey) continue;

          const node = journey.nodes.find((n: JourneyNode) => 
            n.id === enrollment.currentNodeId && 
            n.type === 'action' && (n.data as any)?.meta?.actionType === 'whatsapp'
          );
          if (!node) continue;

          const exitPaths = (node as any).config?.exitPaths;
          if (!exitPaths?.buttonClicked) continue;

          // Find button-specific exit path
          const buttonPath = exitPaths.buttonClicked.find(
            (p: any) => p.buttonConfig?.buttonId === buttonId && p.enabled
          );

          if (!buttonPath) continue;

          // Track event
          if (buttonPath.tracking?.enabled) {
            await trackEvent(enrollment, buttonPath.tracking.eventName, {
              buttonId,
              buttonText,
              messageId: context.id,
              phoneNumber,
              customPayload: buttonPath.buttonConfig?.customPayload,
            });
          }

          // Update profile if configured
          if (buttonPath.profileUpdates) {
            await updateProfile(enrollment.customerId, buttonPath.profileUpdates);
          }

          // Route user
          if (buttonPath.action.type === 'branch' && buttonPath.action.branchId) {
            await routeUserToBranch(enrollment, buttonPath.action.branchId, journey);
          } else if (buttonPath.action.type === 'continue') {
            // Continue to next node
            const edges = journey.edges.filter(e => e.source === node.id);
            if (edges.length > 0) {
              const nextNode = journey.nodes.find(n => n.id === edges[0].target);
              if (nextNode) {
                enrollment.currentNodeId = nextNode.id;
                enrollment.lastActivityAt = new Date().toISOString();
              }
            }
          }

          // Save enrollment
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
    console.error('[Button Click webhook]', error);
    return NextResponse.json(
      { error: 'Failed to process button click' },
      { status: 500 }
    );
  }
}

async function routeUserToBranch(
  enrollment: any,
  branchId: string,
  journey: JourneyDefinition
) {
  const targetNode = journey.nodes.find(n => 
    n.id === branchId || (n as any).metadata?.branchId === branchId
  );

  if (targetNode) {
    enrollment.currentNodeId = targetNode.id;
    enrollment.lastActivityAt = new Date().toISOString();
    
    const activities = readJsonFile<any>('journey-activity-log.json');
    activities.push({
      id: `activity_${Date.now()}`,
      enrollmentId: enrollment.id,
      journeyId: journey.id,
      nodeId: targetNode.id,
      action: 'button_click_routed',
      timestamp: new Date().toISOString(),
      metadata: { branchId },
    });
    writeJsonFile('journey-activity-log.json', activities);
  }
}

async function trackEvent(enrollment: any, eventName: string, properties: Record<string, any>) {
  console.log(`[Event Tracking] ${eventName}`, {
    customerId: enrollment.customerId,
    journeyId: enrollment.journeyId,
    properties,
  });
}

async function updateProfile(customerId: string, updates: Array<{ property: string; value: any; operation: string }>) {
  const customers = readJsonFile<any>('customers.json');
  const customerIndex = customers.findIndex((c: any) => c.id === customerId);
  
  if (customerIndex >= 0) {
    const customer = customers[customerIndex];
    for (const update of updates) {
      if (update.operation === 'set') {
        customer[update.property] = update.value;
      } else if (update.operation === 'increment') {
        customer[update.property] = (customer[update.property] || 0) + update.value;
      } else if (update.operation === 'append') {
        if (!Array.isArray(customer[update.property])) {
          customer[update.property] = [];
        }
        customer[update.property].push(update.value);
      }
    }
    customers[customerIndex] = customer;
    writeJsonFile('customers.json', customers);
  }
}

