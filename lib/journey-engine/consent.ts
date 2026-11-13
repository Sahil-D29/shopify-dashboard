import { prisma } from '@/lib/prisma';
import { isValidPhone, normalizePhone } from '@/lib/whatsapp/normalize-phone';
import crypto from 'crypto';

interface JourneyRecipient {
  id: string;
  phone?: string | null;
  email?: string | null;
}

export async function resolveOptedInWhatsAppRecipient(storeId: string, recipient: JourneyRecipient) {
  const phone = normalizePhone(recipient.phone ?? '');
  const contact = await prisma.contact.findFirst({
    where: {
      storeId,
      optInStatus: 'OPTED_IN',
      OR: [
        { id: recipient.id },
        { shopifyCustomerId: recipient.id },
        ...(recipient.email ? [{ email: recipient.email }] : []),
        ...(phone ? [{ phone }, { phone: recipient.phone! }] : []),
      ],
    },
    select: { id: true, phone: true, email: true, name: true },
  });
  if (!contact?.phone) return null;
  return {
    id: contact.id,
    phone: contact.phone,
    email: contact.email,
    first_name: contact.name,
  };
}

export interface RecordWhatsAppConsentInput {
  storeId: string;
  contactId?: string | null;
  phone: string;
  email?: string | null;
  granted: boolean;
  source: string;
  capturedAt: Date;
  wordingVersion?: string | null;
  evidence?: Record<string, unknown>;
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value ?? {}));

function sameRecipient(data: Record<string, any>, contactId: string, phone: string, email?: string | null) {
  return data.customerId === contactId ||
    normalizePhone(String(data.customerPhone ?? '')) === phone ||
    Boolean(email && String(data.customerEmail ?? '').toLowerCase() === email.toLowerCase());
}

async function resumeLatestConsentSuppressedEnrollment(storeId: string, contactId: string, phone: string, email?: string | null) {
  const journeys = await prisma.journeyDoc.findMany({
    where: { storeId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!journeys.length) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await prisma.journeyEnrollmentDoc.findMany({
    where: {
      journeyId: { in: journeys.map(item => item.id) },
      status: 'suppressed',
      enteredAt: { gte: cutoff },
    },
    orderBy: { enteredAt: 'desc' },
    take: 100,
  });
  const match = candidates.find(item => {
    const data = item.data as Record<string, any>;
    return data.exitReason === 'consent_required' && sameRecipient(data, contactId, phone, email);
  });
  if (!match) return;
  const data = match.data as Record<string, any>;
  const nodeId = typeof data.currentNodeId === 'string' ? data.currentNodeId : '';
  if (!nodeId) return;
  const now = new Date();
  const updated: Record<string, any> = {
    ...data,
    status: 'active',
    completedAt: null,
    lastActivityAt: now.toISOString(),
    metadata: { ...(data.metadata ?? {}), resumedAfterConsentAt: now.toISOString() },
  };
  delete updated.exitReason;
  const scheduleId = `consent:${match.id}:${nodeId}`;
  await prisma.$transaction(async tx => {
    const claimed = await tx.journeyEnrollmentDoc.updateMany({
      where: { id: match.id, status: 'suppressed' },
      data: { status: 'active', data: json(updated) },
    });
    if (!claimed.count) return;
    const schedule = {
      id: scheduleId,
      journeyId: match.journeyId,
      enrollmentId: match.id,
      nodeId,
      resumeAt: now.toISOString(),
      status: 'pending',
      createdAt: now.toISOString(),
      metadata: { kind: 'retry', reason: 'consent_confirmed' },
    };
    await tx.journeyScheduleDoc.upsert({
      where: { id: scheduleId },
      create: {
        id: scheduleId,
        journeyId: match.journeyId,
        enrollmentId: match.id,
        nodeId,
        status: 'pending',
        resumeAt: now,
        data: json(schedule),
      },
      update: { status: 'pending', resumeAt: now, data: json(schedule) },
    });
    await tx.journeyActivityDoc.create({
      data: {
        id: crypto.randomUUID(),
        enrollmentId: match.id,
        data: {
          id: crypto.randomUUID(),
          enrollmentId: match.id,
          timestamp: now.toISOString(),
          eventType: 'consent_confirmed',
          data: { nodeId, source: 'explicit_customer_action' },
        },
      },
    });
  });
}

export async function recordWhatsAppConsent(input: RecordWhatsAppConsentInput) {
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) throw new Error('A valid WhatsApp phone number is required');
  if (!input.source.trim()) throw new Error('A consent source is required');
  if (!Number.isFinite(input.capturedAt.getTime())) throw new Error('A valid consent timestamp is required');
  const email = input.email?.trim().toLowerCase() || null;

  const result = await prisma.$transaction(async tx => {
    const contact = await tx.contact.findFirst({
      where: {
        storeId: input.storeId,
        OR: [
          ...(input.contactId ? [{ id: input.contactId }] : []),
          { phone },
          ...(input.phone !== phone ? [{ phone: input.phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
    const currentAt = input.granted ? contact?.optOutAt : contact?.optInAt;
    const isCurrent = !currentAt || input.capturedAt >= currentAt;
    const consent = {
      source: input.source,
      capturedAt: input.capturedAt.toISOString(),
      wordingVersion: input.wordingVersion ?? undefined,
      status: input.granted ? 'granted' : 'revoked',
    };
    const metadata = { ...((contact?.metadata as Record<string, unknown> | null) ?? {}), whatsappConsent: consent };
    const saved = contact
      ? await tx.contact.update({
          where: { id: contact.id },
          data: {
            ...(email && !contact.email ? { email } : {}),
            ...(isCurrent ? {
              optInStatus: input.granted ? 'OPTED_IN' : 'OPTED_OUT',
              ...(input.granted ? { optInAt: input.capturedAt } : { optOutAt: input.capturedAt }),
              metadata: json(metadata),
            } : {}),
          },
        })
      : await tx.contact.create({
          data: {
            storeId: input.storeId,
            phone,
            email,
            source: 'WEBHOOK',
            optInStatus: input.granted ? 'OPTED_IN' : 'OPTED_OUT',
            ...(input.granted ? { optInAt: input.capturedAt } : { optOutAt: input.capturedAt }),
            metadata: json(metadata),
          },
        });
    await tx.whatsAppConsentEvent.create({
      data: {
        storeId: input.storeId,
        contactId: saved.id,
        phone,
        email,
        status: input.granted ? 'GRANTED' : 'REVOKED',
        source: input.source,
        wordingVersion: input.wordingVersion ?? null,
        occurredAt: input.capturedAt,
        evidence: json(input.evidence),
      },
    });
    return { contact: saved, applied: isCurrent };
  });

  if (input.granted && result.applied) {
    await resumeLatestConsentSuppressedEnrollment(input.storeId, result.contact.id, phone, email);
  }
  return result;
}
