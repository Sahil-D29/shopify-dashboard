export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-message';
import type { JourneyDefinition } from '@/lib/types/journey';

interface InboundMessagePayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          text?: {
            body: string;
          };
          type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'interactive';
          timestamp: string;
          image?: { id: string; mime_type: string; caption?: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string; caption?: string };
          audio?: { id: string; mime_type: string };
        }>;
        contacts?: Array<{
          profile?: { name?: string };
          wa_id: string;
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
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        const contactProfile = change.value?.contacts?.[0];

        for (const message of change.value?.messages || []) {
          const { from: rawPhone, text, timestamp, type: msgType, id: waMessageId } = message;
          const messageText = text?.body?.toUpperCase().trim() || '';
          const normalizedPhone = normalizePhone(rawPhone);

          // ─── PHASE 2: Create Contact, Conversation, Message ────────
          let storeId: string | null = null;
          try {
            // Resolve storeId via WhatsAppConfig matching phoneNumberId
            if (phoneNumberId) {
              const waConfig = await prisma.whatsAppConfig.findFirst({
                where: { phoneNumberId },
                select: { storeId: true },
              });
              storeId = waConfig?.storeId || null;
            }

            // Fallback: try first store
            if (!storeId) {
              const firstStore = await prisma.store.findFirst({ select: { id: true } });
              storeId = firstStore?.id || null;
            }

            if (storeId) {
              // Find or create Contact
              const contact = await prisma.contact.upsert({
                where: { storeId_phone: { storeId, phone: normalizedPhone } },
                update: {
                  lastMessageAt: new Date(),
                  name: contactProfile?.profile?.name || undefined,
                },
                create: {
                  storeId,
                  phone: normalizedPhone,
                  name: contactProfile?.profile?.name || null,
                  source: 'WHATSAPP_INBOUND',
                  optInStatus: 'PENDING',
                  lastMessageAt: new Date(),
                  tags: [],
                  customFields: {},
                },
              });

              // Find or create Conversation
              const conversation = await prisma.conversation.upsert({
                where: { storeId_contactId: { storeId, contactId: contact.id } },
                update: {
                  lastMessageAt: new Date(),
                  lastMessagePreview: (text?.body || `[${msgType}]`).substring(0, 100),
                  unreadCount: { increment: 1 },
                  status: 'OPEN',
                },
                create: {
                  storeId,
                  contactId: contact.id,
                  status: 'OPEN',
                  lastMessageAt: new Date(),
                  lastMessagePreview: (text?.body || `[${msgType}]`).substring(0, 100),
                  unreadCount: 1,
                },
              });

              // Determine message type
              const prismaType = mapWhatsAppType(msgType);
              const content = text?.body || message.image?.caption || message.video?.caption || message.document?.caption || '';

              // Create Message record
              await prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  contactId: contact.id,
                  storeId,
                  direction: 'INBOUND',
                  type: prismaType,
                  content,
                  whatsappMessageId: waMessageId,
                  status: 'DELIVERED',
                },
              });

              // ─── Check Auto-Reply Rules ────────
              if (text?.body) {
                await checkAutoReplyRules(storeId, contact.id, conversation.id, normalizedPhone, text.body);
              }

              // ─── Handle Opt-out/Opt-in via Prisma Contact ────────
              if (OPT_OUT_KEYWORDS.some(keyword => messageText.includes(keyword))) {
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: { optInStatus: 'OPTED_OUT', optOutAt: new Date() },
                });
              } else if (OPT_IN_KEYWORDS.some(keyword => messageText.includes(keyword))) {
                await prisma.contact.update({
                  where: { id: contact.id },
                  data: { optInStatus: 'OPTED_IN', optInAt: new Date() },
                });
              }
            }
          } catch (err) {
            console.error('[Inbound webhook] Prisma error:', err);
            // Don't fail the whole webhook — continue with journey logic
          }

          // ─── EXISTING: Opt-out/opt-in via JSON files (legacy) ────────
          if (OPT_OUT_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptOut(rawPhone);
            continue;
          }

          if (OPT_IN_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptIn(rawPhone);
            continue;
          }

          // ─── EXISTING: Journey enrollment logic (preserved) ────────
          const enrollments = readJsonFile<any>('journey-enrollments.json');
          const enrollment = enrollments.find((e: any) =>
            e.status === 'active' &&
            e.waitingForEvent?.type === 'whatsapp_replied' &&
            e.customerPhone === rawPhone
          );

          if (!enrollment) continue;

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

          if (exitPaths.replied.tracking?.enabled) {
            await trackEvent(enrollment, exitPaths.replied.tracking.eventName, {
              messageText: text?.body,
              phoneNumber: rawPhone,
              timestamp,
            });
          }

          if (OPT_OUT_KEYWORDS.some(keyword => messageText.includes(keyword))) {
            await handleOptOut(rawPhone);
            enrollment.status = 'exited';
            enrollment.completedAt = new Date().toISOString();
          } else {
            if (exitPaths.replied.action.type === 'branch' && exitPaths.replied.action.branchId) {
              await routeUserToBranch(enrollment, exitPaths.replied.action.branchId, journey);
            } else if (exitPaths.replied.action.type === 'continue') {
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

          enrollment.waitingForEvent = null;
          enrollment.waitingForEventTimeout = null;

          const enrollmentIndex = enrollments.findIndex((e: any) => e.id === enrollment.id);
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

// ─── Auto-Reply Rule Checker ────────────────────────────────────

async function checkAutoReplyRules(
  storeId: string,
  contactId: string,
  conversationId: string,
  phone: string,
  messageText: string
) {
  try {
    const rules = await prisma.autoReplyRule.findMany({
      where: { storeId, isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const keywords = Array.isArray(rule.keywords) ? (rule.keywords as string[]) : [];
      let matched = false;

      for (const keyword of keywords) {
        switch (rule.matchType) {
          case 'exact':
            matched = messageText.toLowerCase() === keyword.toLowerCase();
            break;
          case 'contains':
            matched = messageText.toLowerCase().includes(keyword.toLowerCase());
            break;
          case 'regex':
            try {
              matched = new RegExp(keyword, 'i').test(messageText);
            } catch {
              matched = false;
            }
            break;
        }
        if (matched) break;
      }

      if (matched) {
        // Check schedule if configured
        if (rule.schedule) {
          const schedule = rule.schedule as { days?: number[]; startTime?: string; endTime?: string; timezone?: string };
          const now = new Date();
          const day = now.getDay();
          if (schedule.days && !schedule.days.includes(day)) continue;

          if (schedule.startTime && schedule.endTime) {
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            if (currentTime < schedule.startTime || currentTime > schedule.endTime) continue;
          }
        }

        // Send auto-reply
        if (rule.replyType === 'text' && rule.replyContent) {
          await sendWhatsAppMessage({
            storeId,
            contactId,
            conversationId,
            phone,
            type: 'text',
            content: rule.replyContent,
          });
        } else if (rule.replyType === 'template' && rule.templateName) {
          await sendWhatsAppMessage({
            storeId,
            contactId,
            conversationId,
            phone,
            type: 'template',
            templateName: rule.templateName,
            templateComponents: rule.templateData ? [rule.templateData] : [],
          });
        }

        // Only fire the first matching rule
        break;
      }
    }
  } catch (err) {
    console.error('[AutoReply] Error checking rules:', err);
  }
}

// ─── Map WhatsApp type to Prisma MessageType ────────────────────

function mapWhatsAppType(type: string): 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'STICKER' | 'LOCATION' | 'INTERACTIVE' {
  const map: Record<string, any> = {
    text: 'TEXT',
    image: 'IMAGE',
    video: 'VIDEO',
    document: 'DOCUMENT',
    audio: 'AUDIO',
    sticker: 'STICKER',
    location: 'LOCATION',
    interactive: 'INTERACTIVE',
  };
  return map[type] || 'TEXT';
}

// ─── Legacy JSON-file helpers (preserved) ────────────────────────

async function handleOptOut(phoneNumber: string) {
  const customers = readJsonFile<any>('customers.json');
  const customer = customers.find((c: any) => c.phone === phoneNumber);

  if (customer) {
    customer.whatsappOptedOut = true;
    customer.whatsappOptedOutAt = new Date().toISOString();
    const index = customers.findIndex((c: any) => c.id === customer.id);
    if (index >= 0) {
      customers[index] = customer;
      writeJsonFile('customers.json', customers);
    }
  }
}

async function handleOptIn(phoneNumber: string) {
  const customers = readJsonFile<any>('customers.json');
  const customer = customers.find((c: any) => c.phone === phoneNumber);

  if (customer) {
    customer.whatsappOptedOut = false;
    customer.whatsappOptedInAt = new Date().toISOString();
    const index = customers.findIndex((c: any) => c.id === customer.id);
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
