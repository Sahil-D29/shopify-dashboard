import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';

/**
 * Inbound webhook ingestion core (third party → Dorza).
 *
 * Called by the public endpoint `app/api/webhooks/ingest/[token]/route.ts`
 * after the integration + secret have been verified. Routes a normalized
 * payload into the rest of the app so ingested data is usable everywhere:
 *   - contacts  → prisma.contact upsert (Contacts module)
 *   - events    → StorefrontEvent + CustomEventDefinition (Analytics),
 *                 matchAndExecuteJourneys (Journeys), SegmentSyncStatus (Segments)
 *   - facebook_fbp → fbp/fbc stored on the contact's customFields
 *
 * Normalized contract (see docs/WEBHOOKS_INGEST.md):
 *   {
 *     "type": "contact" | "event",
 *     "event": "<name>",                 // when type=event
 *     "contact": { phone?, email?, name?, firstName?, lastName?, tags?[], customFields?{} },
 *     "properties": {...}, "occurredAt": "ISO",
 *     "fbp": "...", "fbc": "..."         // optional facebook_fbp identifiers
 *   }
 */

export interface IngestIntegration {
  id: string;
  storeId: string;
  dataTypes: string[];
  events: string[];
}

interface IncomingContact {
  phone?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface IngestPayload {
  type?: 'contact' | 'event';
  event?: string;
  contact?: IncomingContact;
  properties?: Record<string, unknown>;
  occurredAt?: string;
  fbp?: string;
  fbc?: string;
  [key: string]: unknown;
}

export interface IngestResult {
  ok: boolean;
  status: 'PROCESSED' | 'FAILED';
  eventType: string;
  contactId?: string;
  error?: string;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Upsert a Contact from an inbound payload. Contacts are keyed on
 * (storeId, phone); if no phone is provided we synthesise a stable placeholder
 * from the email so email-only contacts still land (matches the unique key).
 */
async function upsertContact(
  storeId: string,
  incoming: IncomingContact,
  extra?: { fbp?: string; fbc?: string },
): Promise<string | null> {
  const rawPhone = incoming.phone ? normalizePhone(incoming.phone) : '';
  const email = incoming.email?.trim().toLowerCase() || undefined;
  if (!rawPhone && !email) return null;

  // Phone is the unique key; for email-only contacts use a deterministic alias.
  const phoneKey = rawPhone || `email:${email}`;

  const tags = asArray(incoming.tags);
  const customFields = asObject(incoming.customFields);
  if (extra?.fbp) customFields.fbp = extra.fbp;
  if (extra?.fbc) customFields.fbc = extra.fbc;
  const hasCustom = Object.keys(customFields).length > 0;

  const contact = await prisma.contact.upsert({
    where: { storeId_phone: { storeId, phone: phoneKey } },
    update: {
      ...(email ? { email } : {}),
      ...(incoming.name ? { name: incoming.name } : {}),
      ...(incoming.firstName ? { firstName: incoming.firstName } : {}),
      ...(incoming.lastName ? { lastName: incoming.lastName } : {}),
      ...(tags.length ? { tags } : {}),
      ...(hasCustom ? { customFields: customFields as any } : {}),
    },
    create: {
      storeId,
      phone: phoneKey,
      email: email || null,
      name: incoming.name || null,
      firstName: incoming.firstName || null,
      lastName: incoming.lastName || null,
      source: 'WEBHOOK',
      optInStatus: 'PENDING',
      tags,
      customFields: (hasCustom ? customFields : {}) as any,
    },
    select: { id: true },
  });
  return contact.id;
}

/** Flag dynamic segments for re-evaluation (mirrors the Shopify webhook). */
async function flagSegmentReevaluation(topic: string): Promise<void> {
  try {
    await prisma.segmentSyncStatus.upsert({
      where: { id: 'singleton' },
      update: { needsUpdate: true, lastTriggered: new Date(), triggerTopic: topic },
      create: { id: 'singleton', needsUpdate: true, lastTriggered: new Date(), triggerTopic: topic },
    });
  } catch (err) {
    console.warn('[ingest] segment re-eval flag failed (non-fatal):', err);
  }
}

/** Record/define a custom event so it shows in Analytics → custom events. */
async function recordCustomEventDefinition(storeId: string, eventName: string): Promise<void> {
  try {
    await prisma.customEventDefinition.upsert({
      where: { storeId_eventName: { storeId, eventName } },
      update: { eventCount: { increment: 1 }, lastSeenAt: new Date() },
      create: {
        storeId,
        eventName,
        displayName: eventName,
        category: 'webhook',
        eventCount: 1,
        lastSeenAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[ingest] custom event definition upsert failed (non-fatal):', err);
  }
}

export async function processInboundWebhook(
  integration: IngestIntegration,
  body: IngestPayload,
): Promise<IngestResult> {
  const { storeId } = integration;
  const isEvent = body.type === 'event' || (!!body.event && body.type !== 'contact');
  const eventType = isEvent ? String(body.event || 'event') : 'contact';

  try {
    // If the integration restricts accepted events, enforce it for event payloads.
    if (isEvent && integration.events.length > 0 && body.event && !integration.events.includes(body.event)) {
      return { ok: false, status: 'FAILED', eventType, error: `Event "${body.event}" not enabled for this integration` };
    }

    // Upsert contact when present (contact payloads always; events optionally).
    let contactId: string | null = null;
    if (body.contact) {
      contactId = await upsertContact(storeId, body.contact, { fbp: body.fbp, fbc: body.fbc });
    }

    if (isEvent) {
      // Raw event row.
      await prisma.storefrontEvent.create({
        data: {
          storeId,
          customerId: contactId,
          sessionId: (body.properties?.sessionId as string) || `webhook_${Date.now()}`,
          eventType,
          resourceId: (body.properties?.resourceId as string) || null,
          resourceTitle: (body.properties?.resourceTitle as string) || null,
          metadata: { ...asObject(body.properties), source: 'webhook' },
        },
      });

      await recordCustomEventDefinition(storeId, eventType);

      // Journeys: canonical "an event happened" entry point.
      await matchAndExecuteJourneys(`custom:${eventType}`, {
        shop: null,
        payload: { ...body, storeId, contactId },
        receivedAt: body.occurredAt || new Date().toISOString(),
      }).catch(err => console.warn('[ingest] journey match failed (non-fatal):', err));

      // Segments: schedule re-evaluation.
      await flagSegmentReevaluation(`webhook:${eventType}`);
    }

    return { ok: true, status: 'PROCESSED', eventType, contactId: contactId || undefined };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'ingest failed';
    console.error('[ingest] processing error:', err);
    return { ok: false, status: 'FAILED', eventType, error };
  }
}
