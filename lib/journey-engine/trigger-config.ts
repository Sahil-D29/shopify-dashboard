import type { JourneyNode } from '@/lib/types/journey';

/** The event selected in the unified editor must survive legacy serialization. */
export function selectedTriggerEvent(node: JourneyNode): string | undefined {
  const data = node.data as any;
  const config = data?.triggerConfig ?? data?.triggerConfiguration ?? data?.meta?.triggerConfiguration;
  const rules = config?.cleverTapStyle?.targetSegment?.rules ?? config?.targetSegment?.rules ?? [];
  const events = rules.filter((r: any) => r.ruleType === 'user_behavior' && r.action !== 'did_not' && r.eventName).map((r: any) => r.eventName);
  return events.length === 1 ? events[0] : undefined;
}

export function normalizeTriggerNode(node: JourneyNode): JourneyNode {
  if (node.type !== 'trigger') return node;
  const event = selectedTriggerEvent(node);
  if (!event) return node;
  const data = node.data as any;
  const config = data?.triggerConfig ?? data?.triggerConfiguration ?? data?.meta?.triggerConfiguration;
  const rule = (config?.cleverTapStyle?.targetSegment?.rules ?? config?.targetSegment?.rules ?? []).find((r: any) => r.eventName === event);
  const conditions = (rule?.conditions ?? []).filter((c: any) => c.property).map((c: any) => ({ source: 'order', field: c.property, operator: c.operator, value: c.value }));
  return { ...node, subtype: event, data: { ...data, triggerType: event, webhookEvent: event, conditions,
    meta: { ...data?.meta, triggerType: event, webhookEvent: event, conditions } },
    trigger: { type: 'event', eventType: event } } as unknown as JourneyNode;
}
