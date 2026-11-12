import crypto from 'crypto';

import { prisma } from '@/lib/prisma';
import { checkoutKey } from './checkout';

export type JourneyEventOutcome =
  | 'ENROLLED'
  | 'DUPLICATE'
  | 'PURCHASED'
  | 'FILTERED'
  | 'MISSING_CONTACT'
  | 'MISSING_PHONE'
  | 'CONSENT_REQUIRED'
  | 'INVALID_RECOVERY_URL'
  | 'JOURNEY_INACTIVE'
  | 'INTERNAL_FAILURE';

type EvaluationInput = {
  storeId: string;
  journeyId: string;
  event: Record<string, unknown>;
  outcome: JourneyEventOutcome;
  customerId?: string;
  enrollmentId?: string;
  reasonCode?: string;
  receivedAt?: string;
  details?: Record<string, unknown>;
};

function stableEventKey(event: Record<string, unknown>): string {
  const supplied = event.eventId ?? event.webhookFingerprint;
  if (typeof supplied === 'string' && supplied.trim()) {
    return event.duplicate === true ? `${supplied.trim()}:duplicate` : supplied.trim();
  }
  const identity = checkoutKey(event) ?? String(event.contactId ?? event.customerId ?? 'unknown');
  const occurredAt = String(event.updated_at ?? event.created_at ?? event.receivedAt ?? '');
  return crypto.createHash('sha256').update(`${identity}:${occurredAt}`).digest('hex');
}

export async function recordJourneyEventEvaluation(input: EvaluationInput): Promise<void> {
  const key = stableEventKey(input.event);
  const keyCheckout = checkoutKey(input.event);
  const receivedAt = input.receivedAt && Number.isFinite(Date.parse(input.receivedAt))
    ? new Date(input.receivedAt)
    : new Date();
  await prisma.journeyEventEvaluation.upsert({
    where: {
      storeId_journeyId_eventKey: {
        storeId: input.storeId,
        journeyId: input.journeyId,
        eventKey: key,
      },
    },
    create: {
      storeId: input.storeId,
      journeyId: input.journeyId,
      eventKey: key,
      checkoutKey: keyCheckout,
      customerId: input.customerId,
      enrollmentId: input.enrollmentId,
      outcome: input.outcome,
      reasonCode: input.reasonCode,
      details: input.details as any,
      receivedAt,
    },
    update: {
      customerId: input.customerId,
      enrollmentId: input.enrollmentId,
      outcome: input.outcome,
      reasonCode: input.reasonCode,
      details: input.details as any,
    },
  });
}
