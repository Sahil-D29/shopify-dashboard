export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import type { JourneyDefinition } from '@/lib/types/journey';

interface InboundMessagePayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messages: Array<{
          from: string;
          text?: {
            body: string;
          };
          type: 'text' | 'image' | 'video' | 'document';
          timestamp: string;
        }>;
      };
    }>;
  }>;
}

// Opt-out keywords (from subscription settings)
const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'QUIT'];
const OPT_IN_KEYWORDS = ['START', 'SUBSCRIBE', 'YES'];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InboundMessagePayload;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        for (const message of change.value?.messages || []) {
          const { from: phoneNumber, text, timestamp } = message;
          const messageText = text?.body?.toUpperCase().trim() || '';

          // Check for opt-out keywords
          if (OPT_OUT_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptOut(phoneNumber);
            continue;
          }

          // Check for opt-in keywords
          if (OPT_IN_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptIn(phoneNumber);
            continue;
          }

          // Find active enrollment waiting for reply
          const enrollments = readJsonFile<any>('journey-enrollments.json');
          const enrollment = enrollments.find(e => 
            e.status === 'active' &&
            e.waitingForEvent?.type === 'whatsapp_replied' &&
            e.customerPhone === phoneNumber
          );

          if (!enrollment) {
            // No active enrollment waiting for reply
            continue;
          }

          // Load journey and node
          const journeys = readJsonFile<JourneyDefinition>('journeys.json');
          const journey = journeys.find((j: JourneyDefinition) => j.id === enrollment.journeyId);
          if (!journey) continue;

          const node = journey.nodes.find(n => 
            n.id === enrollment.currentNodeId && 
            n.type === 'action' && (n.data as any)?.meta?.actionType === 'whatsapp'
          );
          if (!node) continue;

          const exitPaths = (node as any).config?.exitPaths;
          if (!exitPaths?.replied?.enabled) continue;

          // Track event
          if (exitPaths.replied.tracking?.enabled) {
            await trackEvent(enrollment, exitPaths.replied.tracking.eventName, {
              messageText: text?.body,
              phoneNumber,
              timestamp,
            });
          }

          // Detect opt-out in reply
          if (OPT_OUT_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptOut(phoneNumber);
            enrollment.status = 'exited';
            enrollment.completedAt = new Date().toISOString();
          } else {
            // Route based on reply path
            if (exitPaths.replied.action.type === 'branch' && exitPaths.replied.action.branchId) {
              await routeUserToBranch(enrollment, exitPaths.replied.action.branchId, journey);
            } else if (exitPaths.replied.action.type === 'continue') {
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
          }

          // Clear waiting state
          enrollment.waitingForEvent = null;
          enrollment.waitingForEventTimeout = null;

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
    console.error('[Inbound webhook]', error);
    return NextResponse.json(
      { error: 'Failed to process inbound message' },
      { status: 500 }
    );
  }
}

async function handleOptOut(phoneNumber: string) {
  const customers = readJsonFile<any>('customers.json');
  const customer = customers.find(c => c.phone === phoneNumber);
  
  if (customer) {
    customer.whatsappOptedOut = true;
    customer.whatsappOptedOutAt = new Date().toISOString();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) {
      customers[index] = customer;
      writeJsonFile('customers.json', customers);
    }
  }
}

async function handleOptIn(phoneNumber: string) {
  const customers = readJsonFile<any>('customers.json');
  const customer = customers.find(c => c.phone === phoneNumber);
  
  if (customer) {
    customer.whatsappOptedOut = false;
    customer.whatsappOptedInAt = new Date().toISOString();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) {
      customers[index] = customer;
      writeJsonFile('customers.json', customers);
    }
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
      action: 'replied_routed',
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

