'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { createDefaultUnifiedTriggerConfig } from './utils';
import { RuleSelectionModal } from './RuleSelectionModal';
import { EventConfigurationForm } from './EventConfigurationForm';
import {
  TargetSegmentSection,
  type RuleLocation,
  type RuleLocationMain,
} from './TargetSegmentSection';
import { getEnhancedEventById } from '@/constants/shopifyEvents';
import type {
  UnifiedTriggerConfig,
  UnifiedTriggerRule,
  UnifiedTriggerRuleGroup,
  RuleCategory,
  CleverTapStyleRule,
  CleverTapStyleRuleGroup,
  CleverTapStyleTargetSegment,
  CleverTapStyleTriggerConfig,
  EnhancedUnifiedTriggerConfig,
  ConditionOperator,
  TimeFrame,
  UnifiedTriggerRuleOperator,
  UnifiedTriggerTimeFramePeriod,
} from '@/lib/types/trigger-config';
import {
  Plus,
  Save,
  X,
} from 'lucide-react';
import { AdvancedWhatsAppSettings } from '@/components/campaigns/AdvancedWhatsAppSettings';
import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';

/** Props accepted by TriggerConfigPanel, combining legacy and enhanced trigger data. */
interface TriggerConfigPanelProps {
  triggerConfig: UnifiedTriggerConfig | EnhancedUnifiedTriggerConfig | null;
  status: 'draft' | 'active';
  isOpen: boolean;
  onClose: () => void;
  onChange: (config: EnhancedUnifiedTriggerConfig) => void;
  onStatusChange: (status: 'draft' | 'active') => void;
  onSave: (config: EnhancedUnifiedTriggerConfig) => void;
}

interface SelectedRuleRef {
  ruleId: string;
  location: RuleLocation;
}

const TIMEFRAME_OPTIONS: Array<{ label: string; value: TimeFrame['period'] }> = [
  { value: 'last_24_hours', label: 'Last 24 hours' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

const RULE_ACTIONS: Array<{ value: NonNullable<CleverTapStyleRule['action']>; label: string }> = [
  { value: 'did', label: 'Did' },
  { value: 'did_not', label: 'Did Not' },
];

const CONDITION_OPERATOR_MAP: Record<string, ConditionOperator> = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  does_not_contain: 'not_contains',
  not_contains: 'not_contains',
  greater_than: 'greater_than',
  greater_than_or_equal: 'greater_than_or_equal',
  greater_or_equal: 'greater_than_or_equal',
  less_than: 'less_than',
  less_than_or_equal: 'less_than_or_equal',
  less_or_equal: 'less_than_or_equal',
  exists: 'exists',
  not_exists: 'not_exists',
  does_not_exist: 'not_exists',
  in: 'in',
  not_in: 'not_in',
};

const UNIFIED_OPERATOR_MAP: Record<ConditionOperator, UnifiedTriggerRuleOperator> = {
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

const MAIN_RULE_SCOPE_ID = '__main_rules__';

const toConditionOperator = (operator?: string | null): ConditionOperator =>
  CONDITION_OPERATOR_MAP[operator ?? ''] ?? 'equals';

const toUnifiedOperator = (operator: ConditionOperator | string): UnifiedTriggerRuleOperator => {
  const key = typeof operator === 'string' ? operator : operator;
  return UNIFIED_OPERATOR_MAP[key as ConditionOperator] ?? 'equals';
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 12)}`;
};

const isConfigEqual = (
  a: EnhancedUnifiedTriggerConfig | null | undefined,
  b: EnhancedUnifiedTriggerConfig | null | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/** Converts a legacy unified trigger rule into the CleverTap-style rule structure. */
const convertUnifiedRuleToCleverTap = (rule: UnifiedTriggerRule): CleverTapStyleRule => ({
  id: generateId(),
  ruleType: rule.ruleType as RuleCategory,
  subcategory: rule.category,
  eventName: rule.eventName,
  eventDisplayName: rule.eventName?.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
  action: 'did',
  timeFrame: rule.timeFrame
    ? ({
        period: rule.timeFrame.period,
        customDays: rule.timeFrame.customDays,
      } satisfies TimeFrame)
    : undefined,
  conditions: rule.conditions?.map((condition, index) => ({
    id: condition.property ? `${condition.property}_${index}` : generateId(),
    property: condition.property,
    operator: toConditionOperator(condition.operator),
    value: condition.value ?? '',
  })) ?? [],
});

/** Converts a legacy rule group into the CleverTap-style rule group structure. */
const convertUnifiedGroupToCleverTap = (group: UnifiedTriggerRuleGroup): CleverTapStyleRuleGroup => ({
  id: generateId(),
  operator: group.operator,
  rules: group.rules.map(convertUnifiedRuleToCleverTap),
});

/** Converts a CleverTap-style rule back into the unified trigger format used by existing APIs. */
const convertCleverTapRuleToUnified = (rule: CleverTapStyleRule): UnifiedTriggerRule => ({
  ruleType: rule.ruleType,
  category: rule.subcategory,
  eventName: rule.eventName,
  conditions: rule.conditions.map(condition => ({
    property: condition.property,
    operator: toUnifiedOperator(condition.operator),
    value:
      typeof condition.value === 'number'
        ? condition.value
        : typeof condition.value === 'boolean'
          ? String(condition.value)
          : Array.isArray(condition.value)
            ? condition.value.join(',')
            : (condition.value as string | number | undefined) ?? '',
  })),
  timeFrame: rule.timeFrame
    ? {
        period: (rule.timeFrame.period === 'last_90_days' ? 'last_30_days' : (rule.timeFrame.period ?? 'last_7_days')) as UnifiedTriggerTimeFramePeriod,
        customDays: rule.timeFrame.customDays,
      }
    : undefined,
});

/** Converts a CleverTap-style rule group back into the unified trigger rule group format. */
const convertCleverTapGroupToUnified = (group: CleverTapStyleRuleGroup): UnifiedTriggerRuleGroup => ({
  operator: group.operator,
  rules: group.rules.map(convertCleverTapRuleToUnified),
});

/** Builds a default CleverTap-style trigger configuration using legacy values when available. */
const createDefaultCleverTapConfig = (base: UnifiedTriggerConfig): CleverTapStyleTriggerConfig => ({
  name: 'Audience rules',
  targetSegment: {
    type: (base.targetSegment?.type ?? 'new_segment') as CleverTapStyleTargetSegment['type'],
    segmentId: undefined,
    segmentName: base.segmentName,
    rules: base.targetSegment?.rules?.map(convertUnifiedRuleToCleverTap) ?? [],
    ruleGroups: base.targetSegment?.ruleGroups?.map(convertUnifiedGroupToCleverTap) ?? [],
  },
  subscriptionGroups: base.subscriptionGroups ?? [],
  estimatedUserCount: undefined,
});

/** Ensures any incoming config gets promoted to EnhancedUnifiedTriggerConfig for the UI. */
const ensureEnhancedConfig = (incoming: UnifiedTriggerConfig | null): EnhancedUnifiedTriggerConfig => {
  const base = incoming ?? createDefaultUnifiedTriggerConfig();
  const enhanced = incoming as EnhancedUnifiedTriggerConfig | null;
  const cleverTapStyle = enhanced?.cleverTapStyle ?? createDefaultCleverTapConfig(base);
  return {
    ...base,
    targetSegment: base.targetSegment ?? {
      type: 'new_segment',
      rules: [],
      ruleGroups: [],
    },
    subscriptionGroups: base.subscriptionGroups ?? cleverTapStyle.subscriptionGroups ?? [],
    cleverTapStyle: {
      ...cleverTapStyle,
      targetSegment: {
        ...cleverTapStyle.targetSegment,
        rules: cleverTapStyle.targetSegment.rules ?? [],
        ruleGroups: cleverTapStyle.targetSegment.ruleGroups ?? [],
      },
      subscriptionGroups: cleverTapStyle.subscriptionGroups ?? base.subscriptionGroups ?? [],
    },
  };
};

/** Synchronises CleverTap-style data back into the unified trigger fields for persistence. */
const syncUnifiedFields = (config: EnhancedUnifiedTriggerConfig): EnhancedUnifiedTriggerConfig => {
  if (!config.cleverTapStyle) return config;
  const targetSegment = config.cleverTapStyle.targetSegment;
  const unifiedTarget: UnifiedTriggerConfig['targetSegment'] = {
    type: targetSegment.type,
    rules: targetSegment.rules.map(convertCleverTapRuleToUnified),
    ruleGroups: targetSegment.ruleGroups.map(convertCleverTapGroupToUnified),
  };

  return {
    ...config,
    targetSegment: unifiedTarget,
    subscriptionGroups: config.cleverTapStyle.subscriptionGroups ?? [],
  };
};

const findRule = (
  segment: CleverTapStyleTargetSegment,
  ref: SelectedRuleRef | null,
): { rule: CleverTapStyleRule; location: RuleLocation } | null => {
  if (!ref) return null;
  if (ref.location.type === 'main') {
    const rule = segment.rules.find(r => r.id === ref.ruleId);
    if (!rule) return null;
    return { rule, location: ref.location };
  }
  const group = segment.ruleGroups.find(g => g.id === (ref.location as { type: 'group'; groupId: string }).groupId);
  if (!group) return null;
  const rule = group.rules.find(r => r.id === ref.ruleId);
  if (!rule) return null;
  return {
    rule,
    location: ref.location,
  };
};

const insertRuleAtLocation = (
  segment: CleverTapStyleTargetSegment,
  location: RuleLocation,
  rule: CleverTapStyleRule,
): CleverTapStyleTargetSegment => {
  if (location.type === 'main') {
    const rules = [...segment.rules];
    const index = Math.max(0, Math.min(location.index, rules.length));
    rules.splice(index, 0, rule);
    return { ...segment, rules };
  }

  const ruleGroups = segment.ruleGroups.map(group => {
    if (group.id !== location.groupId) return group;
    const rules = [...group.rules];
    const index = Math.max(0, Math.min(location.index, rules.length));
    rules.splice(index, 0, rule);
    return {
      ...group,
      rules,
    };
  });
  return {
    ...segment,
    ruleGroups,
  };
};

const updateRuleAtLocation = (
  segment: CleverTapStyleTargetSegment,
  location: RuleLocation,
  ruleId: string,
  updater: (rule: CleverTapStyleRule) => CleverTapStyleRule,
): CleverTapStyleTargetSegment => {
  if (location.type === 'main') {
    return {
      ...segment,
      rules: segment.rules.map(rule => (rule.id === ruleId ? updater(rule) : rule)),
    };
  }

  return {
    ...segment,
    ruleGroups: segment.ruleGroups.map(group =>
      group.id === location.groupId
        ? {
            ...group,
            rules: group.rules.map(rule => (rule.id === ruleId ? updater(rule) : rule)),
          }
        : group,
    ),
  };
};

const removeRuleAtLocation = (
  segment: CleverTapStyleTargetSegment,
  location: RuleLocation,
  ruleId: string,
): CleverTapStyleTargetSegment => {
  if (location.type === 'main') {
    return {
      ...segment,
      rules: segment.rules.filter(rule => rule.id !== ruleId),
    };
  }

  return {
    ...segment,
    ruleGroups: segment.ruleGroups.map(group =>
      group.id === location.groupId
        ? {
            ...group,
            rules: group.rules.filter(rule => rule.id !== ruleId),
          }
        : group,
    ),
  };
};

const formatRuleLocation = (groupIndex: number | null, ruleIndex: number) =>
  groupIndex === null ? `Rule ${ruleIndex + 1}` : `Group ${groupIndex + 1}, Rule ${ruleIndex + 1}`;

/**
 * Validates the enhanced trigger configuration and returns human-readable error messages.
 * Ensures each rule has the required event/timeframe and that conditions are complete.
 */
const validateTriggerConfig = (config: EnhancedUnifiedTriggerConfig): string[] => {
  const errors: string[] = [];
  const cleverTap = config.cleverTapStyle;

  if (!cleverTap) {
    errors.push('Trigger configuration missing CleverTap data');
    return errors;
  }

  if (!cleverTap.name || !cleverTap.name.trim()) {
    errors.push('Trigger name is required');
  }

  const segment = cleverTap.targetSegment;
  const hasRules =
    segment.rules.length > 0 || segment.ruleGroups.some(group => group.rules.length > 0);

  if (!hasRules) {
    errors.push('Add at least one rule to continue');
  }

  const validateRule = (rule: CleverTapStyleRule, groupIndex: number | null, ruleIndex: number) => {
    if (rule.ruleType === 'user_behavior' && (!rule.eventName || !rule.eventName.trim())) {
      errors.push(`${formatRuleLocation(groupIndex, ruleIndex)} • Event selection required`);
    }

    if (rule.ruleType === 'user_behavior' && !rule.timeFrame) {
      errors.push(`${formatRuleLocation(groupIndex, ruleIndex)} • Timeframe selection required`);
    }

    rule.conditions.forEach((condition, conditionIndex) => {
      if (!condition.property) {
        errors.push(`${formatRuleLocation(groupIndex, ruleIndex)} • Condition ${conditionIndex + 1} needs a property`);
      }
      const requiresValue = !['exists', 'not_exists'].includes(condition.operator);
      const hasValue =
        condition.value !== undefined &&
        condition.value !== '' &&
        !(Array.isArray(condition.value) && condition.value.length === 0);
      if (requiresValue && !hasValue) {
        errors.push(`${formatRuleLocation(groupIndex, ruleIndex)} • Condition ${conditionIndex + 1} needs a value`);
      }
    });
  };

  segment.rules.forEach((rule, index) => validateRule(rule, null, index));
  segment.ruleGroups.forEach((group, groupIndex) =>
    group.rules.forEach((rule, ruleIndex) => validateRule(rule, groupIndex, ruleIndex)),
  );

  return errors;
};

/**
 * CleverTap-style trigger configuration panel used in the journey builder.
 * Provides rule management, event selection, condition editing, validation, and status controls.
 */
export function TriggerConfigPanel({
  triggerConfig,
  status,
  isOpen,
  onClose,
  onChange,
  onStatusChange,
  onSave,
}: TriggerConfigPanelProps) {
  const toast = useToast();
  const pendingSyncRef = useRef(false);
  const [localConfig, setLocalConfig] = useState<EnhancedUnifiedTriggerConfig>(() =>
    syncUnifiedFields(ensureEnhancedConfig(triggerConfig)),
  );
  const [selectedRule, setSelectedRule] = useState<SelectedRuleRef | null>(null);
  const [expandedRuleGroupId, setExpandedRuleGroupId] = useState<string | null>(null);
  const [isRuleModalOpen, setRuleModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<RuleLocation | null>(null);
  const [customDayWindow, setCustomDayWindow] = useState<number>(7);
  const lastPropConfigRef = useRef<EnhancedUnifiedTriggerConfig | null>(null);
  const inlineEditorContainerRef = useRef<HTMLDivElement | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppActionConfig>({
    templateId: '',
    templateName: '',
    templateStatus: 'APPROVED',
    templateLanguage: '',
    templateCategory: '',
    variableMappings: [],
    bodyFields: [],
    mediaUrl: '',
    useDynamicMedia: false,
    sendWindow: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '21:00',
      timezone: 'customer',
    },
    rateLimiting: {
      maxPerDay: 3,
      maxPerWeek: 10,
    },
    failureHandling: {
      retryCount: 1,
      retryDelay: 15,
      fallbackAction: 'continue',
    },
    skipIfOptedOut: true,
    exitPaths: {},
  });

  useEffect(() => {
    if (!isOpen) return;
    const enhanced = syncUnifiedFields(ensureEnhancedConfig(triggerConfig));
    if (lastPropConfigRef.current && isConfigEqual(lastPropConfigRef.current, enhanced)) {
      return;
    }
    lastPropConfigRef.current = enhanced;
    setLocalConfig(enhanced);
    setRuleModalOpen(false);
    setPendingLocation(null);
    setSelectedRule(prev => {
      const exists = enhanced.cleverTapStyle ? findRule(enhanced.cleverTapStyle.targetSegment, prev) : null;
      return exists ? prev : null;
    });
    pendingSyncRef.current = false;
  }, [triggerConfig, isOpen]);

  const updateConfig = useCallback(
    (updater: (prev: EnhancedUnifiedTriggerConfig) => EnhancedUnifiedTriggerConfig) => {
      setLocalConfig(prev => {
        const next = syncUnifiedFields(updater(prev));
        pendingSyncRef.current = true;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!pendingSyncRef.current) return;
    pendingSyncRef.current = false;
    onChange(localConfig);
  }, [localConfig, onChange]);

  const segment = useMemo(() => {
    if (!localConfig.cleverTapStyle) {
      return { type: 'new_segment' as const, rules: [], ruleGroups: [] };
    }
    const target = localConfig.cleverTapStyle.targetSegment;
    return {
      ...target,
      rules: Array.isArray(target.rules) ? target.rules : [],
      ruleGroups: Array.isArray(target.ruleGroups) ? target.ruleGroups : [],
    };
  }, [localConfig]);
  const validationErrors = useMemo(() => validateTriggerConfig(localConfig), [localConfig]);

  const selectedRuleData = useMemo(
    () => findRule(segment, selectedRule),
    [segment, selectedRule],
  );

  useEffect(() => {
    if (!selectedRule) {
      setExpandedRuleGroupId(null);
    }
  }, [selectedRule]);

  useEffect(() => {
    const timeFrame = selectedRuleData?.rule.timeFrame;
    if (timeFrame?.period === 'custom' && typeof timeFrame.customDays === 'number') {
      setCustomDayWindow(timeFrame.customDays);
    }
  }, [selectedRuleData]);

  useEffect(() => {
    if (!selectedRuleData) return;
    requestAnimationFrame(() => {
      inlineEditorContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const focusable = inlineEditorContainerRef.current?.querySelector('[data-rule-editor-focus="true"]') as
        | HTMLElement
        | null;
      focusable?.focus({ preventScroll: true });
    });
  }, [selectedRuleData?.rule.id]);

  const getEventPropertiesForRule = useCallback((rule?: CleverTapStyleRule) => {
    if (!rule || !rule.eventName) return [];
    const event = getEnhancedEventById(rule.eventName);
    return event?.properties ?? [];
  }, []);

  const handleSave = useCallback(() => {
    if (validationErrors.length > 0) {
      toast.error(validationErrors.join('\n'));
      return;
    }
    onSave(localConfig);
    toast.success('Trigger configuration saved');
    onClose();
  }, [validationErrors, onSave, localConfig, onClose, toast]);

  const handleExitRuleEditing = useCallback(() => {
    setSelectedRule(null);
    setExpandedRuleGroupId(null);
  }, []);

  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      handleSave();
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    }
  }, [handleSave, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [isOpen, handleKeyboardShortcuts]);

  const handleAddRule = (location: RuleLocationMain) => {
    setPendingLocation(location);
    setRuleModalOpen(true);
    toast.info('Choose a rule to add');
  };

  const handleRuleGroupAdd = () => {
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: {
          ...(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment' as const, rules: [], ruleGroups: [] }),
          ruleGroups: [
            ...(prev.cleverTapStyle?.targetSegment?.ruleGroups ?? []),
            {
              id: generateId(),
              operator: 'OR',
              rules: [],
            },
          ],
        },
      },
    }));
    toast.success('Rule group added');
  };

  const handleAddRuleToGroup = (groupId: string) => {
    const group = segment.ruleGroups.find(item => item.id === groupId);
    const index = group ? group.rules.length : 0;
    setPendingLocation({ type: 'group', groupId, index });
    setRuleModalOpen(true);
    toast.info('Choose a rule to add to this group');
  };

  const closeRuleModal = () => {
    setRuleModalOpen(false);
    setPendingLocation(null);
  };

  const handleRuleSelected = (ruleId: string, category: RuleCategory) => {
    if (!pendingLocation) {
      closeRuleModal();
      return;
    }
    const newRule: CleverTapStyleRule = {
      id: generateId(),
      ruleType: category,
      subcategory: ruleId,
      eventName: undefined,
      eventDisplayName: undefined,
      action: 'did',
      timeFrame: { period: 'last_7_days' },
      conditions: [],
    };

    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: insertRuleAtLocation(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }, pendingLocation, newRule),
      },
    }));
    setSelectedRule({ ruleId: newRule.id, location: pendingLocation });
    closeRuleModal();
    toast.success('Rule added');
  };

  const handleRemoveRule = (ruleId: string, location: RuleLocation) => {
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: removeRuleAtLocation(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }, location, ruleId),
      },
    }));
    setSelectedRule(current => {
      if (!current) return current;
      return current.ruleId === ruleId ? null : current;
    });
    toast.success('Rule removed');
  };

  const handleRemoveGroup = (groupId: string) => {
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: {
          ...(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }),
          ruleGroups: (prev.cleverTapStyle?.targetSegment?.ruleGroups ?? []).filter(group => group.id !== groupId),
        },
      },
    }));
    setSelectedRule(current => {
      if (!current || current.location.type !== 'group') return current;
      return current.location.groupId === groupId ? null : current;
    });
    toast.success('Rule group removed');
  };

  const updateSelectedRule = (updater: (rule: CleverTapStyleRule) => CleverTapStyleRule) => {
    if (!selectedRuleData) return;
    const { location } = selectedRuleData;
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: updateRuleAtLocation(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }, location, selectedRuleData.rule.id, updater),
      },
    }));
  };

  const handleSegmentTypeChange = (type: CleverTapStyleTargetSegment['type']) => {
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: {
          ...(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }),
          type,
        },
      },
    }));
  };

  const handleTimeFrameChange = (period: TimeFrame['period']) => {
    updateSelectedRule(rule => ({
      ...rule,
      timeFrame: period === 'custom' ? { period, customDays: customDayWindow } : { period },
    }));
  };

  const handleCustomDaysChange = (value: number) => {
    setCustomDayWindow(value);
    updateSelectedRule(rule => ({
      ...rule,
      timeFrame: {
        period: 'custom',
        customDays: value,
      },
    }));
  };

  const handleStatusToggle = (nextStatus: 'draft' | 'active') => {
    if (nextStatus === status) return;
    if (nextStatus === 'active') {
      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
        return;
      }
    }
    onStatusChange(nextStatus);
    toast.success(`Trigger ${nextStatus === 'active' ? 'activated' : 'set to draft'}`);
  };

  const handleRuleEditRequest = (ruleId: string, location: RuleLocation) => {
    console.log('Editing group:', location.type === 'group' ? location.groupId : MAIN_RULE_SCOPE_ID);
    if (location.type === 'group') {
      setExpandedRuleGroupId(location.groupId);
    } else {
      setExpandedRuleGroupId(MAIN_RULE_SCOPE_ID);
    }
    setSelectedRule({ ruleId, location });
  };

  const totalRuleCount = segment.rules.length + segment.ruleGroups.reduce((acc, group) => acc + group.rules.length, 0);

  const handleRuleSave = (updatedRule: CleverTapStyleRule) => {
    if (!selectedRuleData) return;
    const { location, rule } = selectedRuleData;
    updateConfig(prev => ({
      ...prev,
      cleverTapStyle: {
        ...prev.cleverTapStyle,
        name: prev.cleverTapStyle?.name ?? 'Audience rules',
        targetSegment: updateRuleAtLocation(prev.cleverTapStyle?.targetSegment ?? { type: 'new_segment', rules: [], ruleGroups: [] }, location, rule.id, () => updatedRule),
      },
    }));
    toast.success('Rule updated');
    handleExitRuleEditing();
  };

  const renderInlineEditor = ({ rule }: { rule: CleverTapStyleRule; location: RuleLocation }) => {
    if (!selectedRuleData || selectedRuleData.rule.id !== rule.id) {
      return null;
    }

    return (
      <div ref={inlineEditorContainerRef}>
        <EventConfigurationForm rule={selectedRuleData.rule} onSave={handleRuleSave} onCancel={handleExitRuleEditing} />
      </div>
    );
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#FAF9F6] transition-[flex-grow,flex-basis,width] duration-200 ease-in-out">
      <header className="flex h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-[#E8E4DE] bg-white px-4 sm:px-6">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B8977F]">Trigger</p>
          <h2 className="text-xl font-semibold text-[#4A4139]">Unified trigger configuration</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E8E4DE] bg-white p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleStatusToggle('draft')}
              className={`rounded-full px-3 py-1 transition ${
                status === 'draft' ? 'bg-[#8B7DD6] text-white shadow-sm' : 'text-[#8B7F76]'
              }`}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => handleStatusToggle('active')}
              className={`rounded-full px-3 py-1 transition ${
                status === 'active' ? 'bg-[#8B7DD6] text-white shadow-sm' : 'text-[#8B7F76]'
              }`}
            >
              Active
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[#8B7F76] transition hover:border-[#E8E4DE] hover:bg-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div
          role="region"
          aria-label="Trigger configuration"
          className="custom-scroll flex h-full flex-col gap-6 overflow-y-auto px-4 pb-24 pt-4 sm:px-6 md:px-8"
        >
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#4A4139]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E9D8FD] text-xs font-bold text-[#6B46C1]">
                1
              </span>
              <span>Select rule type</span>
              {totalRuleCount > 0 ? (
                <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4C51BF]">
                  {totalRuleCount} rule{totalRuleCount !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            <TargetSegmentSection
              segment={segment}
              onSegmentTypeChange={handleSegmentTypeChange}
              onAddRule={handleAddRule}
              onAddRuleGroup={handleRuleGroupAdd}
              onAddRuleToGroup={handleAddRuleToGroup}
              onRemoveRule={handleRemoveRule}
              onRemoveGroup={handleRemoveGroup}
              onEditRule={handleRuleEditRequest}
              forceExpanded={Boolean(selectedRule)}
              editingRuleRef={
                selectedRuleData
                  ? { ruleId: selectedRuleData.rule.id, location: selectedRuleData.location }
                  : null
              }
              expandedGroupId={expandedRuleGroupId}
              highlightMain={selectedRule?.location.type === 'main'}
              renderInlineEditor={renderInlineEditor}
              advancedPanel={
                <AdvancedWhatsAppSettings
                  className="w-full"
                  config={whatsappConfig}
                  selectedTemplate={null}
                  bodyFields={whatsappConfig.bodyFields}
                  variableMappings={whatsappConfig.variableMappings}
                  variablePreview={{}}
                  onConfigChange={(updates) => setWhatsappConfig(prev => ({ ...prev, ...updates }))}
                  onBodyFieldChange={(fields) => setWhatsappConfig(prev => ({ ...prev, bodyFields: fields }))}
                  onVariableMappingsChange={(mappings) => setWhatsappConfig(prev => ({ ...prev, variableMappings: mappings }))}
                  dataSources={[]}
                  triggerContext="generic"
                  storageKey="journey-trigger-advanced-settings"
                />
              }
            />
          </section>
        </div>
      </div>

      <footer className="flex h-16 flex-shrink-0 items-center justify-between gap-4 border-t border-[#E8E4DE] bg-[#F5F3EE] px-4 sm:px-6">
        <div className="space-y-1 text-xs text-[#8B7F76]">
          <div>Changes save automatically. Use “Save &amp; Continue” to confirm trigger configuration.</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#A08F80]">
            <span>
              Shortcuts:
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">Esc</kbd>
              <span>close</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">⌘</kbd>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">S</kbd>
              <span>/</span>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">Ctrl</kbd>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">S</kbd>
              <span>save</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">⌘</kbd>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">↵</kbd>
              <span>/</span>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">Ctrl</kbd>
              <kbd className="rounded border border-[#D1C7BD] bg-white px-1 py-0.5">↵</kbd>
              <span>save</span>
            </span>
          </div>
        </div>
        <Button type="button" onClick={handleSave} className="ml-auto flex items-center gap-2 bg-[#8B7DD6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7C6CD0]">
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save &amp; Continue</span>
          <span className="inline sm:hidden">Save</span>
        </Button>
      </footer>

      <RuleSelectionModal
        isOpen={isRuleModalOpen}
        onClose={closeRuleModal}
        onSelectRule={handleRuleSelected}
      />
    </div>
  );
}
