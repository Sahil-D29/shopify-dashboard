import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
import { matchAndExecuteJourneys } from '@/lib/journey-engine/trigger-matcher';
import { parseShiprocketAbandonedCart, webhookFingerprint } from '@/lib/webhooks/shiprocket';

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
  name: string;
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
  /** Stable cross-payload person id (NitroCommerce nitro_id / userId) for de-duplication. */
  externalId?: string;
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
  duplicate?: boolean;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const firstString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
};

const validDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
  const phone = firstString(src.phone, (src as any).phoneNumber, (src as any).phone_number, (src as any).mobile, (src as any).msisdn, (src as any).whatsapp);
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

const isAliasPhone = (p?: string | null): boolean =>
  !!p && (p.startsWith('email:') || p.startsWith('nitro:'));

/**
 * Upsert a Contact from an inbound payload, de-duplicating one person into ONE
 * contact across separate phone/email identify calls.
 *
 * Resolution order: existing by externalId (nitro_id) → by phone → by email.
 * A real phone always upgrades a placeholder alias key, so the Phone field never
 * keeps an `email:`/`nitro:` value once a real number is known.
 */
async function upsertContact(
  storeId: string,
  incoming: IncomingContact,
  extra: { integration: IngestIntegration; receivedAt: string; fbp?: string; fbc?: string },
): Promise<string | null> {
  const rawPhone = incoming.phone ? normalizePhone(incoming.phone) : '';
  const email = incoming.email?.trim().toLowerCase() || undefined;
  const externalId = incoming.externalId?.trim() || undefined;
  if (!rawPhone && !email && !externalId) return null;

  // Senders often provide a single full name; split it so the UI (which builds
  // the display name from firstName/lastName) shows the person, not "Unknown".
  let firstName = incoming.firstName;
  let lastName = incoming.lastName;
  if (!firstName && !lastName && incoming.name) {
    const parts = incoming.name.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  }

  // Custom fields to merge (includes the stable nitro_id for future matching).
  const incomingCf = asObject(incoming.customFields);
  if (externalId) incomingCf.nitro_id = externalId;
  if (extra?.fbp) incomingCf.fbp = extra.fbp;
  if (extra?.fbc) incomingCf.fbc = extra.fbc;
  const tags = asArray(incoming.tags);

  // Find an existing contact to merge into.
  let existing: { id: string; phone: string; customFields: unknown; metadata: unknown } | null = null;
  if (externalId) {
    existing = await prisma.contact.findFirst({
      where: { storeId, customFields: { path: ['nitro_id'], equals: externalId } },
      select: { id: true, phone: true, customFields: true, metadata: true },
    });
  }
  if (!existing && rawPhone) {
    existing = await prisma.contact.findUnique({
      where: { storeId_phone: { storeId, phone: rawPhone } },
      select: { id: true, phone: true, customFields: true, metadata: true },
    });
  }
  if (!existing && email) {
    existing = await prisma.contact.findFirst({
      where: { storeId, email },
      select: { id: true, phone: true, customFields: true, metadata: true },
    });
  }

  if (existing) {
    const mergedCf = { ...asObject(existing.customFields), ...incomingCf };
    const previousMetadata = asObject(existing.metadata);
    const previousSources = asObject(previousMetadata.webhookSources);
    const previousSource = asObject(previousSources[extra.integration.id]);
    const metadata = {
      ...previousMetadata,
      webhookSources: {
        ...previousSources,
        [extra.integration.id]: {
          integrationId: extra.integration.id,
          name: extra.integration.name,
          firstSeenAt: firstString(previousSource.firstSeenAt) || extra.receivedAt,
          lastSeenAt: extra.receivedAt,
        },
      },
    };
    const data: any = { customFields: mergedCf, metadata };
    if (email) data.email = email;
    if (incoming.name) data.name = incoming.name;
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (tags.length) data.tags = tags;
    // Upgrade a placeholder alias to a real phone number when one arrives.
    if (rawPhone && isAliasPhone(existing.phone)) data.phone = rawPhone;
    try {
      await prisma.contact.update({ where: { id: existing.id }, data });
    } catch {
      // phone-unique conflict (real number already on another contact) — keep alias.
      delete data.phone;
      await prisma.contact.update({ where: { id: existing.id }, data });
    }
    return existing.id;
  }

  // No match — create. Prefer a real phone; otherwise a deterministic alias key.
  const phoneKey = rawPhone || (email ? `email:${email}` : `nitro:${externalId}`);
  const created = await prisma.contact.create({
    data: {
      storeId,
      phone: phoneKey,
      email: email || null,
      name: incoming.name || null,
      firstName: firstName || null,
      lastName: lastName || null,
      source: 'WEBHOOK',
      optInStatus: 'PENDING',
      tags,
      customFields: incomingCf as any,
      metadata: {
        webhookSources: {
          [extra.integration.id]: {
            integrationId: extra.integration.id,
            name: extra.integration.name,
            firstSeenAt: extra.receivedAt,
            lastSeenAt: extra.receivedAt,
          },
        },
      } as any,
    },
    select: { id: true },
  });
  return created.id;
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
  displayName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const incoming = properties
      ? Object.entries(properties)
          .filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
          .map(([name]) => name)
      : [];
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
        displayName,
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
  displayName?: string;
  occurredAt?: string;
  resourceId?: string;
  resourceTitle?: string;
  sessionId?: string;
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
        externalId: firstString(b.nitro_id, b.userId),
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
    const externalId = firstString(b.userId, b.nitro_id);
    const contact =
      cust.phone || cust.email || cust.name || externalId
        ? { phone: firstString(cust.phone), email: firstString(cust.email), name: firstString(cust.name), externalId }
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

  // Shiprocket's cart shape has no event name, so recognize it before generic parsing.
  const shiprocket = parseShiprocketAbandonedCart(body);
  let parsed: ParsedInbound = shiprocket
    ? { kind: 'event', ...shiprocket }
    : parseNitroCommerce(body);
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
  const receivedAt = parsed.occurredAt || body.occurredAt || new Date().toISOString();

  try {
    // Upsert the contact (events carry a nested customer; identify carries the value).
    let contactId: string | null = null;
    if (parsed.contact) {
      contactId = await upsertContact(storeId, parsed.contact, {
        integration,
        receivedAt,
        fbp: body.fbp,
        fbc: body.fbc,
      });
    }

    if (parsed.kind === 'event' && parsed.eventName) {
      const eventName = parsed.eventName;
      const resourceId = parsed.resourceId || (properties.resource_id != null ? String(properties.resource_id) : undefined);
      const fingerprint = webhookFingerprint(integration.id, eventName, body);
      const duplicate = await prisma.storefrontEvent.findFirst({
        where: {
          storeId,
          eventType: eventName,
          metadata: { path: ['webhookFingerprint'], equals: fingerprint },
        },
        select: { id: true },
      });

      if (duplicate) {
        return {
          ok: true,
          status: 'PROCESSED',
          eventType,
          contactId: contactId || undefined,
          duplicate: true,
        };
      }

      await prisma.storefrontEvent.create({
        data: {
          storeId,
          customerId: contactId,
          sessionId: parsed.sessionId || firstString((body as any).userId, (properties as any).roaming_id) || `webhook_${fingerprint.slice(0, 16)}`,
          eventType: eventName,
          resourceId: resourceId || null,
          resourceTitle: parsed.resourceTitle || firstString((properties as any).title) || null,
          metadata: {
            ...properties,
            source: 'webhook',
            webhookIntegrationId: integration.id,
            webhookIntegrationName: integration.name,
            webhookFingerprint: fingerprint,
          } as any,
          createdAt: validDate(receivedAt),
        },
      });

      await recordCustomEventDefinition(storeId, eventName, parsed.displayName || eventName, properties);

      // Journeys: canonical "an event happened" entry point. Skipped during
      // historical backfill so old events don't retroactively fire journeys.
      if (!opts?.skipJourneys) {
        await matchAndExecuteJourneys(`custom:${eventName}`, {
          shop: null,
          payload: { ...body, storeId, contactId },
          receivedAt,
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
