'use client';

import { nanoid } from 'nanoid';
import type {
  CleverTapStyleRule,
  ConditionOperator,
  EnhancedUnifiedTriggerConfig,
  EventCondition,
  UnifiedTriggerRuleCondition,
  UnifiedTriggerRuleOperator,
} from '@/lib/types/trigger-config';
import { createDefaultUnifiedTriggerConfig } from '../builder/trigger/utils';
import type { TriggerConfigState, EventFilter, Rule } from './types';
import { initialTriggerConfigState } from './TriggerConfig';

const EVENT_OPERATOR_MAP: Record<EventFilter['operator'], EventCondition['operator']> = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  not_contains: 'not_contains',
  gt: 'greater_than',
  gte: 'greater_than_or_equal',
  lt: 'less_than',
  lte: 'less_than_or_equal',
  in: 'in',
  not_in: 'not_in',
  exists: 'exists',
};

const UNIFIED_TO_CONDITION_OPERATOR_MAP: Record<UnifiedTriggerRuleOperator, ConditionOperator> = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  does_not_contain: 'not_contains',
  greater_than: 'greater_than',
  less_than: 'less_than',
  exists: 'exists',
  does_not_exist: 'not_exists',
};

const CONDITION_TO_UNIFIED_OPERATOR_MAP: Record<ConditionOperator, UnifiedTriggerRuleOperator> = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  not_contains: 'does_not_contain',
  greater_than: 'greater_than',
  less_than: 'less_than',
  greater_than_or_equal: 'greater_than',
  less_than_or_equal: 'less_than',
  exists: 'exists',
  not_exists: 'does_not_exist',
  in: 'contains',
  not_in: 'does_not_contain',
};

const CONDITION_TO_EVENT_OPERATOR_MAP: Record<ConditionOperator, EventFilter['operator']> = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  not_contains: 'not_contains',
  greater_than: 'gt',
  less_than: 'lt',
  greater_than_or_equal: 'gte',
  less_than_or_equal: 'lte',
  exists: 'exists',
  not_exists: 'not_contains',
  in: 'in',
  not_in: 'not_in',
};

function normaliseEventFilterValue(filter: EventFilter): EventCondition['value'] {
  if (filter.operator === 'exists') return '';
  if (filter.operator === 'in' || filter.operator === 'not_in') {
    if (Array.isArray(filter.value)) return filter.value;
    if (typeof filter.value === 'string') {
      return filter.value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  if (typeof filter.value === 'string') {
    const numeric = Number(filter.value);
    if (!Number.isNaN(numeric) && filter.operator.match(/gt|gte|lt|lte/)) {
      return numeric;
    }
  }
  return filter.value;
}

function normaliseUnifiedConditionValue(
  value: EventCondition['value'],
): UnifiedTriggerRuleCondition['value'] {
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

function deriveTimeFrame(rule: Rule | undefined): CleverTapStyleRule['timeFrame'] | undefined {
  if (!rule || rule.type !== 'withinWindow' || !rule.window) return undefined;
  const { unit, value } = rule.window;
  if (unit === 'days') {
    switch (value) {
      case 1:
        return { period: 'last_24_hours' };
      case 7:
        return { period: 'last_7_days' };
      case 30:
        return { period: 'last_30_days' };
      case 90:
        return { period: 'last_90_days' };
      default:
        return { period: 'custom', customDays: value };
    }
  }
  return { period: 'custom', customDays: value };
}

export function configToState(
  config: EnhancedUnifiedTriggerConfig | undefined,
  status: 'draft' | 'active' = 'draft',
): TriggerConfigState {
  if (!config) {
    return { ...initialTriggerConfigState, status };
  }

  const base: TriggerConfigState = {
    ...initialTriggerConfigState,
    status,
    name: config.cleverTapStyle?.name ?? config.segmentName ?? 'New Trigger',
    description: config.cleverTapStyle?.targetSegment?.segmentName ?? config.segmentName ?? '',
    triggerType: 'event',
  };

  const cleverTapSegment = config.cleverTapStyle?.targetSegment;
  const legacyRules = config.targetSegment?.rules ?? [];

  const rulesSource: CleverTapStyleRule[] =
    cleverTapSegment?.rules ??
    legacyRules.map(rule => ({
      id: nanoid(),
      ruleType: 'user_behavior',
      subcategory: 'event',
      eventName: rule.eventName,
      conditions: (rule.conditions ?? []).map(condition => ({
        id: nanoid(),
        property: condition.property,
        operator: UNIFIED_TO_CONDITION_OPERATOR_MAP[condition.operator] ?? 'equals',
        value: condition.value ?? '',
      })),
    }));

  const firstRule = rulesSource[0];
  if (firstRule?.eventName) {
    base.events = [firstRule.eventName];
    base.eventFilters = (firstRule.conditions ?? []).map(condition => ({
      id: condition.id ?? nanoid(),
      property: condition.property ?? '',
      operator: CONDITION_TO_EVENT_OPERATOR_MAP[condition.operator] ?? 'equals',
      value: condition.value ?? '',
      conjunction: 'AND',
    }));
  }

  if (config.cleverTapStyle?.estimatedUserCount) {
    base.preview = {
      estimatedCount: config.cleverTapStyle.estimatedUserCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  return base;
}

export function stateToConfig(
  state: TriggerConfigState,
  baseConfig?: EnhancedUnifiedTriggerConfig,
): EnhancedUnifiedTriggerConfig {
  const clonedBase =
    baseConfig != null
      ? typeof structuredClone === 'function'
        ? structuredClone(baseConfig)
        : JSON.parse(JSON.stringify(baseConfig))
      : null;

  const config: EnhancedUnifiedTriggerConfig =
    clonedBase ?? createDefaultUnifiedTriggerConfig();

  const firstEvent = state.events[0];

  const timeframeRule = state.rules.find(rule => rule.type === 'withinWindow');
  const cleverTapRule: CleverTapStyleRule | undefined = firstEvent
    ? {
        id: state.eventFilters[0]?.id ?? nanoid(),
        ruleType: 'user_behavior',
        subcategory: 'event',
        eventName: firstEvent,
        eventDisplayName: firstEvent.replace(/_/g, ' '),
        timeFrame: deriveTimeFrame(timeframeRule),
        conditions: state.eventFilters
          .filter(filter => filter.property && filter.operator)
          .map(filter => ({
            id: filter.id,
            property: filter.property,
            operator: EVENT_OPERATOR_MAP[filter.operator],
            value: normaliseEventFilterValue(filter),
          })),
      }
    : undefined;

  config.segmentName = state.description ?? state.name;
  config.cleverTapStyle = {
    name: state.name,
    subscriptionGroups: config.cleverTapStyle?.subscriptionGroups ?? [],
    estimatedUserCount: config.cleverTapStyle?.estimatedUserCount,
    targetSegment: {
      type: 'new_segment',
      segmentName: state.description,
      ruleGroups: config.cleverTapStyle?.targetSegment?.ruleGroups ?? [],
      rules: cleverTapRule ? [cleverTapRule] : [],
    },
  };

  if (cleverTapRule) {
    config.targetSegment = config.targetSegment ?? {
      type: 'new_segment',
      rules: [],
    };
    config.targetSegment.rules = config.targetSegment.rules ?? [];
    config.targetSegment.rules[0] = {
      ruleType: 'user_behavior',
      category: 'shopify_event',
      eventName: cleverTapRule.eventName,
      conditions: cleverTapRule.conditions?.map(condition => ({
        property: condition.property,
        operator: CONDITION_TO_UNIFIED_OPERATOR_MAP[condition.operator],
        value: normaliseUnifiedConditionValue(condition.value),
      })) ?? [],
      timeFrame: cleverTapRule.timeFrame
        ? (() => {
            const { period, customDays } = cleverTapRule.timeFrame;
            switch (period) {
              case 'last_24_hours':
              case 'last_7_days':
              case 'last_30_days':
                return { period };
              case 'last_90_days':
                return { period: 'custom', customDays: 90 };
              case 'custom':
              default:
                return {
                  period: 'custom',
                  customDays: customDays ?? undefined,
                };
            }
          })()
        : undefined,
    };
  }

  return config;
}

