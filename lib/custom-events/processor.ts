import prisma from '@/lib/prisma';
import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';

export interface CustomEventInput {
  storeId: string;
  eventName: string;
  customerId?: string;
  email?: string;
  phone?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
}

export async function processCustomEvent(input: CustomEventInput): Promise<string> {
  const {
    storeId,
    eventName,
    customerId,
    email,
    phone,
    sessionId,
    properties = {},
  } = input;

  const eventType = `custom:${eventName}`;

  // 1. Resolve customer if not provided directly
  let resolvedCustomerId = customerId || null;
  if (!resolvedCustomerId && (email || phone)) {
    const contact = await prisma.contact.findFirst({
      where: {
        storeId,
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true, shopifyCustomerId: true },
    });
    if (contact) {
      resolvedCustomerId = contact.shopifyCustomerId || contact.id;
    }
  }

  // 2. Store in StorefrontEvent
  const event = await prisma.storefrontEvent.create({
    data: {
      storeId,
      customerId: resolvedCustomerId,
      sessionId: sessionId || 'api',
      eventType,
      metadata: {
        ...properties,
        ...(email ? { _email: email } : {}),
        ...(phone ? { _phone: phone } : {}),
      },
    },
  });

  // 3. Fan out to downstream systems (non-blocking)
  const eventData = {
    storeId,
    customerId: resolvedCustomerId,
    email,
    phone,
    properties,
    eventName,
    eventType,
  };

  // Journey trigger matching
  matchAndExecuteJourneys(eventType, eventData).catch((err) => {
    console.error(`[CustomEvent] Journey matching failed for ${eventType}:`, err);
  });

  // 4. Update event definition stats
  prisma.customEventDefinition.update({
    where: { storeId_eventName: { storeId, eventName } },
    data: {
      eventCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  }).catch(() => {});

  return event.id;
}
