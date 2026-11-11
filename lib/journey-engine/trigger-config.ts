import type { JourneyNode } from '@/lib/types/journey';
import type { EnhancedUnifiedTriggerConfig, UnifiedTriggerRuleCondition } from '@/lib/types/trigger-config';

type JsonRecord = Record<string, any>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function rulesFrom(config: any): any[] {
  return config?.cleverTapStyle?.targetSegment?.rules ?? config?.targetSegment?.rules ?? [];
}

function eventFromConfig(config: any): string | undefined {
  const events = rulesFrom(config)
    .filter((rule: any) => rule?.ruleType === 'user_behavior' && rule?.action !== 'did_not')
    .map((rule: any) => nonEmpty(rule?.eventName))
    .filter(Boolean) as string[];
  return events.length === 1 ? events[0] : undefined;
}

/** Resolve the one executable event represented by old or current editor shapes. */
export function selectedTriggerEvent(node: JourneyNode): string | undefined {
  if (node.type !== 'trigger') return undefined;
  const data = (node.data ?? {}) as JsonRecord;
  const meta = isRecord(data.meta) ? data.meta : {};
  const trigger: JsonRecord = isRecord(node.trigger) ? node.trigger : {};
  const direct = [
    trigger.webhookEvent,
    data.webhookEvent,
    meta.webhookEvent,
    data.eventName,
    meta.eventName,
    data.shopifyEvent?.customEventName,
    meta.shopifyEvent?.customEventName,
  ].map(nonEmpty).find(Boolean);
  if (direct) return direct;

  for (const config of [data.triggerConfig, meta.triggerConfig, data.triggerConfiguration, meta.triggerConfiguration]) {
    const event = eventFromConfig(config);
    if (event) return event;
  }
  return undefined;
}

function normaliseConditions(node: JourneyNode, event: string): UnifiedTriggerRuleCondition[] {
  const data = (node.data ?? {}) as JsonRecord;
  const meta = isRecord(data.meta) ? data.meta : {};
  for (const config of [data.triggerConfig, meta.triggerConfig, data.triggerConfiguration, meta.triggerConfiguration]) {
    const rule = rulesFrom(config).find((candidate: any) => candidate?.eventName === event);
    if (Array.isArray(rule?.conditions)) {
      return rule.conditions
        .filter((condition: any) => nonEmpty(condition?.property))
        .map((condition: any) => ({
          property: String(condition.property),
          operator: condition.operator ?? 'equals',
          value: condition.value,
          label: condition.label,
          valueLabel: condition.valueLabel,
        }));
    }
  }
  const raw = Array.isArray(data.conditions) ? data.conditions : Array.isArray(meta.conditions) ? meta.conditions : [];
  return raw
    .filter((condition: any) => nonEmpty(condition?.field ?? condition?.property))
    .map((condition: any) => ({
      property: String(condition.field ?? condition.property),
      operator: condition.operator ?? 'equals',
      value: condition.value,
    }));
}

export function canonicalEventTriggerConfig(event: string, conditions: UnifiedTriggerRuleCondition[] = []): EnhancedUnifiedTriggerConfig {
  const toConditionOperator = (operator: UnifiedTriggerRuleCondition['operator']) => {
    if (operator === 'does_not_contain') return 'not_contains' as const;
    if (operator === 'does_not_exist') return 'not_exists' as const;
    return operator;
  };
  const rule = {
    ruleType: 'user_behavior' as const,
    category: 'Event (Shiprocket)',
    eventName: event,
    conditions,
    timeFrame: { period: 'last_30_days' as const },
  };
  return {
    targetSegment: { type: 'new_segment', rules: [rule], ruleGroups: [] },
    subscriptionGroups: [],
    cleverTapStyle: {
      name: event === 'custom:abandoned_cart' ? 'New abandoned checkout' : event.replace(/[_:]/g, ' '),
      targetSegment: {
        type: 'new_segment',
        rules: [{
          id: `event_${event.replace(/[^a-z0-9]+/gi, '_')}`,
          ruleType: 'user_behavior',
          subcategory: 'Shiprocket',
          eventName: event,
          eventDisplayName: event === 'custom:abandoned_cart' ? 'Abandoned checkout' : event,
          action: 'did',
          timeFrame: { period: 'last_30_days' },
          conditions: conditions.map((condition, index) => ({
            id: `condition_${index}`,
            property: condition.property,
            operator: toConditionOperator(condition.operator),
            value: condition.value ?? '',
          })),
        }],
        ruleGroups: [],
      },
      subscriptionGroups: [],
      estimatedUserCount: 0,
    },
  };
}

function canonicalMeta(current: JsonRecord, event: string, conditions: UnifiedTriggerRuleCondition[]): JsonRecord {
  const triggerConfig = canonicalEventTriggerConfig(event, conditions);
  const entryFrequency = isRecord(current.entryFrequency)
    ? current.entryFrequency
    : { allowReentry: false, cooldown: null, entryLimit: null };
  const entryWindow = isRecord(current.entryWindow)
    ? current.entryWindow
    : { startsAt: null, endsAt: null, timezone: 'UTC' };
  const next: JsonRecord = {
    ...current,
    unified: true,
    triggerType: 'event_trigger',
    webhookEvent: event,
    eventName: event,
    eventSource: event === 'custom:abandoned_cart' ? 'Shiprocket' : current.eventSource,
    conditions: conditions.map(condition => ({
      source: 'order',
      field: condition.property,
      operator: condition.operator,
      value: condition.value,
    })),
    conditionSummary: event === 'custom:abandoned_cart' ? 'Shiprocket • abandoned checkout' : `Event • ${event}`,
    isConfigured: true,
    triggerConfig,
    triggerConfiguration: {
      category: 'shopify_event',
      shopifyEvent: {
        eventType: 'custom_event',
        customEventName: event,
        productSelection: { mode: 'any', productIds: [], collectionIds: [] },
      },
      entryFrequency,
      entryWindow,
    },
    entryFrequency,
    entryWindow,
  };
  delete next.manual;
  delete next.manualTrigger;
  return next;
}

/** Canonicalize conflicting legacy trigger fields before rendering, validation, or execution. */
export function normalizeTriggerNode(node: JourneyNode): JourneyNode {
  if (node.type !== 'trigger') return node;
  const event = selectedTriggerEvent(node);
  if (!event) return node;
  const data = (node.data ?? {}) as JsonRecord;
  const conditions = normaliseConditions(node, event);
  const canonicalData = canonicalMeta(data, event, conditions);
  canonicalData.meta = canonicalMeta(isRecord(data.meta) ? data.meta : {}, event, conditions);
  return {
    ...node,
    subtype: 'event_trigger',
    data: canonicalData,
    trigger: { type: 'webhook', webhookEvent: event },
  } as JourneyNode;
}
