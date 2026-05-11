import type { EnhancedUnifiedTriggerConfig } from '@/lib/types/trigger-config';

/**
 * Builds the default enhanced trigger configuration used when a new trigger node is created.
 */
export const createDefaultUnifiedTriggerConfig = (): EnhancedUnifiedTriggerConfig => ({
  segmentName: undefined,
  targetSegment: {
    type: 'new_segment',
    rules: [],
    ruleGroups: [],
  },
  subscriptionGroups: [],
  entryFrequency: {
    allowReentry: true,
    cooldown: null,
    entryLimit: null,
  },
  entryWindow: undefined,
  estimate: undefined,
  cleverTapStyle: {
    name: 'My Trigger',
    targetSegment: {
      type: 'new_segment',
      rules: [],
      ruleGroups: [],
    },
    subscriptionGroups: [],
    estimatedUserCount: 0,
  },
});

