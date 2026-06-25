/**
 * Background evaluation for non-event journey triggers (Segment Joined, and a
 * basis for Date/Time). Event triggers (Shopify/WhatsApp/storefront/custom) are
 * push-driven via matchAndExecuteJourneys; these are pull-driven and run from the
 * in-process scheduler in instrumentation.ts.
 *
 * Segment membership is resolved with the shared Contact-aware engine
 * (calculateSegmentStats — Contacts ⋃ Shopify, graceful) and de-duplicated against
 * existing enrollments via canEnterJourney, so each member is enrolled at most once.
 */
import { prisma } from '@/lib/prisma';
import { ShopifyClient } from '@/lib/shopify/client';
import { calculateSegmentStats } from '@/lib/utils/segment-stats';
import { startJourneyExecution } from '@/lib/journey-engine/executor';
import { canEnterJourney } from '@/lib/journey-engine/trigger-matcher';
import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';

interface TriggerNodeMeta {
  triggerType?: string;
  segmentId?: string;
  [key: string]: unknown;
}

function readTriggerMeta(node: JourneyNode): TriggerNodeMeta {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  const triggerType =
    (typeof meta.triggerType === 'string' && meta.triggerType) ||
    (typeof data.triggerType === 'string' && data.triggerType) ||
    (typeof data.subtype === 'string' && data.subtype) ||
    undefined;
  const segmentId =
    (typeof meta.segmentId === 'string' && meta.segmentId) ||
    (typeof data.segmentId === 'string' && data.segmentId) ||
    undefined;
  return { triggerType: triggerType || undefined, segmentId: segmentId || undefined };
}

async function enrollSegmentMembers(
  journey: JourneyDefinition,
  trigger: JourneyNode,
  storeId: string,
  segmentId: string,
): Promise<number> {
  let count = 0;
  try {
    // Graceful client — calculateSegmentStats merges Contacts and degrades when
    // Shopify is unavailable.
    const client = new ShopifyClient({ shop: '', accessToken: '' });
    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) return 0;
    const conditionGroups = (segment.filters as { conditionGroups?: unknown } | null)?.conditionGroups ?? [];
    const stats = await calculateSegmentStats({
      client,
      storeId,
      segmentId,
      conditionGroups: conditionGroups as never,
      forceRefresh: false,
    });
    const members = (stats.customers ?? []) as ShopifyCustomer[];
    for (const member of members) {
      const id = String(member.id ?? '');
      if (!id) continue;
      if (!(await canEnterJourney(journey, id))) continue; // already enrolled / re-entry gate
      await startJourneyExecution(
        journey,
        {
          id,
          email: member.email ?? null,
          phone: member.phone ?? null,
          first_name: member.first_name ?? null,
          last_name: member.last_name ?? null,
        },
        trigger,
        {},
      );
      count++;
    }
  } catch (error) {
    console.error('[journey-trigger] segment_joined enrollment failed:', error);
  }
  return count;
}

/**
 * One scheduler tick: evaluate Segment-Joined triggers across all active journeys
 * and enroll any members not already enrolled. Safe to run frequently.
 */
export async function runJourneyTriggerTick(): Promise<{ enrolled: number }> {
  let enrolled = 0;
  const docs = await prisma.journeyDoc.findMany({ where: { status: 'ACTIVE' } });
  for (const doc of docs) {
    const journey = doc.data as unknown as JourneyDefinition;
    const triggers = (journey.nodes ?? []).filter(n => n.type === 'trigger');
    for (const trigger of triggers) {
      const meta = readTriggerMeta(trigger);
      if (meta.triggerType === 'segment_joined' && meta.segmentId) {
        enrolled += await enrollSegmentMembers(journey, trigger, doc.storeId, meta.segmentId);
      }
      // date_time / abandoned_cart / derived events are handled by their own
      // push paths or are planned follow-ups.
    }
  }
  return { enrolled };
}
