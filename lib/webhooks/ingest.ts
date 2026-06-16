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

const firstString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
};

/** Infer the event name from a variety of webhook payload shapes. */
function inferEventName(body: IngestPayload): string | undefined {
  return firstString(
    body.event,
    (body as any).eventType,
    (body as any).event_name,
    (body as any).topic,
    (body as any).name,
    body.type && body.type !== 'contact' ? body.type : undefined,
  );
}

/** Pull contact fields from contact/customer/visitor/user/profile or top-level. */
function extractIncomingContact(body: IngestPayload): IncomingContact | null {
  const nested = (body.contact || (body as any).customer || (body as any).visitor || (body as any).user || (body as any).profile) as Record<string, unknown> | undefined;
  const src: Record<string, unknown> = nested && typeof nested === 'object' ? nested : (body as Record<string, unknown>);
  const phone = firstString(src.phone, (src as any).phoneNumber, (src as any).mobile, (src as any).msisdn, (src as any).whatsapp);
  const email = firstString(src.email, (src as any).emailAddress, (src as any).email_address);
  if (!phone && !email) return null;
  return {
    phone,
    email,
    name: firstString(src.name, (src as any).fullName, (src as any).full_name),
    firstName: firstString(src.firstName, (src as any).first_name),
    lastName: firstString(src.lastName, (src as any).last_name),
    tags: Array.isArray((src as any).tags) ? (src as any).tags.filter((t: unknown) => typeof t === 'string') : undefined,
    customFields: asObject((src as any).customFields ?? (src as any).custom_fields ?? (src as any).attributes) || undefined,
  };
}

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
  const eventName = inferEventName(body);
  const isEvent = body.type === 'contact' ? false : !!eventName;
  const eventType = isEvent ? String(eventName) : 'contact';

  try {
    // NOTE: we intentionally do NOT hard-reject events that aren't in the
    // integration's selected list — every received payload is recorded so no
    // data is silently dropped. The selected events are used for journey
    // triggering / filtering, not as an ingress gate.

    // Upsert contact from whatever shape the sender used (contact/customer/visitor/top-level).
    let contactId: string | null = null;
    const incomingContact = extractIncomingContact(body);
    if (incomingContact) {
      contactId = await upsertContact(storeId, incomingContact, { fbp: body.fbp, fbc: body.fbc });
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
