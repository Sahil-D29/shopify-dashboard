import type { UnifiedTriggerConfig, UnifiedTriggerRule } from '@/lib/types/trigger-config';

type JsonMap = Record<string, unknown>;

const DEFAULT_RULE: UnifiedTriggerRule = {
  ruleType: 'user_behavior',
  category: 'Event (Dot)',
  eventName: undefined,
  conditions: [],
  timeFrame: { period: 'last_30_days' },
};

const normaliseEventName = (meta: JsonMap): string | undefined => {
  const eventName = typeof meta.eventName === 'string' ? meta.eventName : undefined;
  const webhookEvent = typeof meta.webhookEvent === 'string' ? meta.webhookEvent : undefined;
  if (eventName && eventName.trim().length > 0) return eventName.trim();
  if (webhookEvent && webhookEvent.trim().length > 0) return webhookEvent.trim();
  return undefined;
};

export const convertLegacyTriggerMetaToUnified = (meta: JsonMap | undefined): UnifiedTriggerConfig | null => {
  if (!meta) return null;

  const triggerType = typeof meta.triggerType === 'string' ? meta.triggerType : undefined;
  const segmentName = typeof meta.segmentName === 'string' ? meta.segmentName : undefined;
  const segmentId = typeof meta.segmentId === 'string' ? meta.segmentId : undefined;
  const eventName = normaliseEventName(meta);

  const rules: UnifiedTriggerRule[] = [];

  if (eventName) {
    rules.push({
      ...DEFAULT_RULE,
      eventName,
    });
  } else if (triggerType === 'segment_joined' && segmentId) {
    rules.push({
      ruleType: 'user_property',
      category: 'Segments',
      conditions: [
        {
          property: 'segment_id',
          operator: 'equals',
          value: segmentId,
        },
      ],
      timeFrame: { period: 'last_30_days' },
    });
  } else {
    rules.push({ ...DEFAULT_RULE });
  }

  return {
    segmentName: segmentName ?? undefined,
    targetSegment: {
      type: segmentId ? 'existing_segment' : 'new_segment',
      rules,
      ruleGroups: [],
    },
    subscriptionGroups: Array.isArray(meta.subscriptionGroups)
      ? (meta.subscriptionGroups as string[])
      : undefined,
  };
};

