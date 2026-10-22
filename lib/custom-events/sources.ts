import { prisma } from '@/lib/prisma';
import type { EventSource } from '@/lib/types/event-source';

export async function getWebhookSourcesByEvent(
  storeId: string,
  eventNames?: string[],
): Promise<Map<string, EventSource[]>> {
  const names = eventNames?.map(name => name.replace(/^custom:/, '')).filter(Boolean);
  if (names && names.length === 0) return new Map();

  const deliveries = await prisma.webhookEvent.findMany({
    where: {
      storeId,
      status: 'PROCESSED',
      eventType: names ? { in: names } : { notIn: ['identify', 'unknown'] },
    },
    distinct: ['eventType', 'integrationId'],
    select: {
      eventType: true,
      integration: { select: { id: true, name: true } },
    },
  });

  const result = new Map<string, EventSource[]>();
  for (const delivery of deliveries) {
    const eventName = delivery.eventType.replace(/^custom:/, '');
    const source: EventSource = {
      kind: 'webhook',
      id: delivery.integration.id,
      name: delivery.integration.name,
    };
    const existing = result.get(eventName) || [];
    if (!existing.some(item => item.id === source.id)) existing.push(source);
    result.set(eventName, existing.sort((a, b) => a.name.localeCompare(b.name)));
  }
  return result;
}
