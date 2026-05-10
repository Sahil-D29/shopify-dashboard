import type { UnifiedTriggerRule, UnifiedTriggerRuleTimeFrame } from '@/lib/types/trigger-config';

export interface TriggerFormRule extends UnifiedTriggerRule {
  internalId: string;
}

export interface TriggerFormRuleGroup {
  internalId: string;
  operator: 'AND' | 'OR';
  rules: TriggerFormRule[];
}

export type RuleLocation =
  | { type: 'main'; index: number }
  | { type: 'group'; groupId: string; index: number };

export type PendingRuleContext =
  | { type: 'main'; insertIndex: number }
  | { type: 'group'; groupId: string; insertIndex: number };

export type TimeFrameSelection = UnifiedTriggerRuleTimeFrame;

