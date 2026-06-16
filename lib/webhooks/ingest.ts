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

const propType = (v: unknown): 'number' | 'boolean' | 'string' =>
  typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';

/**
 * Record/define a custom event so it shows in Analytics → custom events and in
 * the segment-builder event picker. Accumulates the set of property keys seen
 * for this event so they become filterable in segments.
 */
async function recordCustomEventDefinition(
  storeId: string,
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const incoming = properties ? Object.keys(properties) : [];
    const existing = await prisma.customEventDefinition.findUnique({
      where: { storeId_eventName: { storeId, eventName } },
      select: { properties: true },
    });
    const prevNames: string[] = Array.isArray(existing?.properties)
      ? (existing!.properties as any[]).map(p => p?.name).filter((n): n is string => typeof n === 'string')
      : [];
    const mergedNames = Array.from(new Set([...prevNames, ...incoming])).slice(0, 60);
    const propDefs = mergedNames.map(name => ({ name, type: propType(properties?.[name]) }));

    await prisma.customEventDefinition.upsert({
      where: { storeId_eventName: { storeId, eventName } },
      update: { eventCount: { increment: 1 }, lastSeenAt: new Date(), properties: propDefs as any },
      create: {
        storeId,
        eventName,
        displayName: eventName,
        category: 'webhook',
        eventCount: 1,
        lastSeenAt: new Date(),
        properties: propDefs as any,
      },
    });
  } catch (err) {
    console.warn('[ingest] custom event definition upsert failed (non-fatal):', err);
  }
}

interface ParsedInbound {
  kind: 'event' | 'identify' | 'none';
  eventName?: string;
  contact?: IncomingContact | null;
  properties?: Record<string, unknown>;
}

/**
 * Parse NitroCommerce's two payload shapes:
 *  - Behavioral event: { eventName, eventVal:{ ...props, customer:{name,email,phone} }, city,state,country,pincode, u }
 *  - Identify:         { type:'PHONE'|'EMAIL', contact:'<value>', name, city,state,country,postal, nitro_id, identified_by }
 */
function parseNitroCommerce(body: IngestPayload): ParsedInbound {
  const b = body as Record<string, any>;

  // Identify payload.
  const t = typeof b.type === 'string' ? b.type.toUpperCase() : '';
  if ((t === 'PHONE' || t === 'EMAIL') && typeof b.contact === 'string') {
    const val = b.contact.trim();
    const cf: Record<string, unknown> = {};
    for (const k of ['city', 'state', 'country', 'postal', 'nitro_id', 'identified_by']) {
      if (b[k] != null && b[k] !== '') cf[k] = b[k];
    }
    return {
      kind: 'identify',
      contact: {
        phone: t === 'PHONE' ? val : undefined,
        email: t === 'EMAIL' ? val : undefined,
        name: firstString(b.name),
        customFields: cf,
      },
    };
  }

  // Behavioral event payload.
  if (typeof b.eventName === 'string' && b.eventName.trim()) {
    const ev = asObject(b.eventVal);
    const cust = asObject(ev.customer);
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ev)) if (k !== 'customer') properties[k] = v;
    for (const k of ['city', 'state', 'country', 'pincode']) if (b[k] != null && b[k] !== '') properties[k] = b[k];
    if (b.u) properties.url = b.u;
    const contact =
      cust.phone || cust.email || cust.name
        ? { phone: firstString(cust.phone), email: firstString(cust.email), name: firstString(cust.name) }
        : null;
    return { kind: 'event', eventName: b.eventName.trim(), contact, properties };
  }

  return { kind: 'none' };
}

export async function processInboundWebhook(
  integration: IngestIntegration,
  body: IngestPayload,
  opts?: { skipJourneys?: boolean },
): Promise<IngestResult> {
  const { storeId } = integration;

  // 1. Try NitroCommerce's known shapes; 2. fall back to the generic contract.
  let parsed = parseNitroCommerce(body);
  if (parsed.kind === 'none') {
    const generic = extractIncomingContact(body);
    const genericEvent = inferEventName(body);
    if (genericEvent && body.type !== 'contact') {
      parsed = { kind: 'event', eventName: genericEvent, contact: generic, properties: asObject(body.properties) };
    } else if (generic) {
      parsed = { kind: 'identify', contact: generic, properties: {} };
    }
  }

  const eventType =
    parsed.kind === 'event' ? String(parsed.eventName) : parsed.kind === 'identify' ? 'identify' : 'unknown';
  const properties = parsed.properties || {};

  try {
    // Upsert the contact (events carry a nested customer; identify carries the value).
    let contactId: string | null = null;
    if (parsed.contact) {
      contactId = await upsertContact(storeId, parsed.contact, { fbp: body.fbp, fbc: body.fbc });
    }

    if (parsed.kind === 'event' && parsed.eventName) {
      const eventName = parsed.eventName;
      const resourceId = properties.resource_id != null ? String(properties.resource_id) : undefined;

      await prisma.storefrontEvent.create({
        data: {
          storeId,
          customerId: contactId,
          sessionId: firstString((body as any).userId, (properties as any).roaming_id) || `webhook_${Date.now()}`,
          eventType: eventName,
          resourceId: resourceId || null,
          resourceTitle: firstString((properties as any).title) || null,
          metadata: { ...properties, source: 'nitro' } as any,
        },
      });

      await recordCustomEventDefinition(storeId, eventName, properties);

      // Journeys: canonical "an event happened" entry point. Skipped during
      // historical backfill so old events don't retroactively fire journeys.
      if (!opts?.skipJourneys) {
        await matchAndExecuteJourneys(`custom:${eventName}`, {
          shop: null,
          payload: { ...body, storeId, contactId },
          receivedAt: body.occurredAt || new Date().toISOString(),
        }).catch(err => console.warn('[ingest] journey match failed (non-fatal):', err));
      }

      // Segments: schedule re-evaluation.
      await flagSegmentReevaluation(`webhook:${eventName}`);
    } else if (parsed.kind === 'identify' && contactId) {
      await flagSegmentReevaluation('webhook:identify');
    }

    return { ok: true, status: 'PROCESSED', eventType, contactId: contactId || undefined };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'ingest failed';
    console.error('[ingest] processing error:', err);
    return { ok: false, status: 'FAILED', eventType, error };
  }
}
