"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Node, Edge, Connection } from '@xyflow/react';
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';

import type {
  JourneyConfig,
  JourneyDefinition,
  JourneyEdge as JourneyEdgeType,
  JourneyNode,
  JourneyNodeBase,
  JourneyStats,
  JourneyTriggerType,
  TriggerNode,
  DelayNode,
  ConditionNode,
  ActionNode,
  GoalNode,
} from '@/lib/types/journey';
import type {
  WhatsAppTemplate,
  FailureHandlingConfig,
  RateLimitingConfig,
  SendWindowConfig,
  VariableMapping,
  WhatsAppActionConfig,
  WhatsAppTemplateStatus,
} from '@/lib/types/whatsapp-config';
import type {
  DelayConfig,
  Duration,
  FixedTimeDelayConfig,
  OptimalSendTimeConfig,
  TimeOfDay,
  WaitForAttributeConfig,
  WaitForEventConfig,
  WaitUntilTimeConfig,
} from '@/lib/types/delay-config';
import type { GoalConfig } from '@/lib/types/goal-config';
import type { ConditionConfig } from '@/lib/types/condition-config';
import type { ExperimentConfig } from '@/lib/types/experiment-config';
import type {
  DurationValue,
  EntryFrequencySettings,
  EntryWindowSettings,
  JourneyTriggerConfiguration,
  ManualTriggerConfig,
  SegmentTriggerConfig,
  ShopifyEventTriggerConfig,
  TimeBasedTriggerConfig,
  UnifiedTriggerConfig,
  UnifiedTriggerRule,
  EnhancedUnifiedTriggerConfig,
  AudienceEstimate,
  ProductSelectionConfig,
} from '@/lib/types/trigger-config';

import { useToast } from '@/lib/hooks/useToast';

import { useRouter } from 'next/navigation';

import { isUnifiedTriggerEnabled } from '@/lib/featureFlags';

import { JourneyEdge } from './JourneyEdge';
import { JourneyNodeInspector } from './JourneyNodeInspector';
import { JourneySettingsDrawer } from './JourneySettingsDrawer';
import { journeyNodeTypes, type JourneyNodeData } from './nodes';
import { JourneySidebar } from './JourneySidebar';
import { JourneyToolbar } from './JourneyToolbar';
import { JOURNEY_NODE_CATALOG } from './nodeCatalog';
import TriggerConfigModal from '../modals/TriggerConfigModal';
import WhatsAppActionModal, { type StepId } from '../modals/WhatsAppActionModal';
import DelayConfigModal from '../nodes/delay/DelayConfigModal';
import ExperimentConfigModal from '../nodes/experiment/ExperimentConfigModal';
import ConditionConfigModal from '../modals/ConditionConfigModal';
import { GoalConfigModal } from '../nodes/goal/GoalConfigModal';
import { createDefaultUnifiedTriggerConfig } from './trigger/utils';
import { convertLegacyTriggerMetaToUnified } from './trigger/legacyConversion';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { TestModeBanner } from '../test-mode/TestModeBanner';
import { TestUserPanel } from '../test-mode/TestUserPanel';
import { TestExecutionPanel } from '../test-mode/TestExecutionPanel';
import { ValidationModal } from '../test-mode/ValidationModal';
import { ExecutionLogModal } from '../test-mode/ExecutionLogModal';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading';
import { getWindowStorage } from '@/lib/window-storage';
import type { ValidationError, JourneyExecutionLog, TestUser } from '@/lib/types/test-mode';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GripVertical,
  Menu,
  X,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fallbackMessage } from '@/lib/utils/errors';
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface JourneyBuilderInnerProps {
  journeyId: string;
}

type BuilderStatus = 'draft' | 'active' | 'paused';

type JsonMap = Record<string, unknown>;

type MutableJourneyNode = JourneyNodeBase & {
  trigger?: TriggerNode['trigger'];
  delay?: DelayNode['delay'];
  condition?: ConditionNode['condition'];
  action?: ActionNode['action'];
  goal?: GoalNode['goal'];
};

type VariantMeta = JsonMap & { id?: string; label?: string };

const DEFAULT_WHATSAPP_SEND_WINDOW: SendWindowConfig = {
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '21:00',
  timezone: 'customer',
};

const DEFAULT_WHATSAPP_RATE_LIMIT: RateLimitingConfig = {
  maxPerDay: 3,
  maxPerWeek: 10,
};

const DEFAULT_WHATSAPP_FAILURE_HANDLING: FailureHandlingConfig = {
  retryCount: 1,
  retryDelay: 15,
  fallbackAction: 'continue',
};

const TEST_MODE_POLL_INTERVAL_MS = 8000;
const MAX_TEST_MODE_RETRIES = 3;

function findCatalogNodeBySubtype(subtype?: string) {
  if (!subtype) return undefined;
  return JOURNEY_NODE_CATALOG.flatMap(category => category.nodes).find(node => node.subtype === subtype);
}

function rehydrateFlowNode(node: Node<JourneyNodeData>): Node<JourneyNodeData> {
  const iconCandidate = node.data.icon;
  if (typeof iconCandidate === 'function') {
    return node;
  }
  const catalogNode = findCatalogNodeBySubtype(node.data.subtype);
  if (!catalogNode) {
    return node;
  }
  return {
    ...node,
    data: {
      ...node.data,
      icon: catalogNode.icon,
      variant: node.data.variant ?? catalogNode.variant,
    },
  };
}

function coerceDataSource(value: unknown): VariableMapping['dataSource'] {
  if (value === 'customer' || value === 'order' || value === 'product' || value === 'custom' || value === 'static') {
    return value;
  }
  return 'static';
}

function isSendWindowConfig(value: unknown): value is SendWindowConfig {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Array.isArray((value as SendWindowConfig).daysOfWeek) &&
    typeof (value as SendWindowConfig).startTime === 'string' &&
    typeof (value as SendWindowConfig).endTime === 'string' &&
    typeof (value as SendWindowConfig).timezone === 'string'
  );
}

function isRateLimitingConfig(value: unknown): value is RateLimitingConfig {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as RateLimitingConfig).maxPerDay === 'number' &&
    typeof (value as RateLimitingConfig).maxPerWeek === 'number'
  );
}

function isFailureHandlingConfig(value: unknown): value is FailureHandlingConfig {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as FailureHandlingConfig).retryCount === 'number' &&
    typeof (value as FailureHandlingConfig).retryDelay === 'number' &&
    typeof (value as FailureHandlingConfig).fallbackAction === 'string'
  );
}

type VariableMappingLike = {
  variable?: unknown;
  dataSource?: unknown;
  source?: unknown;
  property?: unknown;
  field?: unknown;
  fallbackValue?: unknown;
  customValue?: unknown;
};

function toVariableMapping(input: unknown, fallbackVariable?: string): VariableMapping | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as VariableMappingLike;
  const variableCandidate = typeof record.variable === 'string' ? record.variable : fallbackVariable ?? '';
  const variable = variableCandidate.trim();
  if (!variable) {
    return null;
  }

  const property =
    typeof record.property === 'string'
      ? record.property
      : typeof record.field === 'string'
        ? record.field
        : '';
  const fallbackValue =
    typeof record.fallbackValue === 'string'
      ? record.fallbackValue
      : typeof record.customValue === 'string'
        ? record.customValue
        : '';

  return {
    variable,
    dataSource: coerceDataSource(record.dataSource ?? record.source),
    property,
    fallbackValue,
  } satisfies VariableMapping;
}

function coerceVariableMappings(value: unknown): VariableMapping[] {
  if (Array.isArray(value)) {
    return value
      .map(item => toVariableMapping(item))
      .filter((mapping): mapping is VariableMapping => Boolean(mapping));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => toVariableMapping(raw, key))
      .filter((mapping): mapping is VariableMapping => Boolean(mapping));
  }

  return [];
}

function extractWhatsAppConfigFromMeta(meta?: JourneyNodeData['meta']): WhatsAppActionConfig | undefined {
  if (!meta) return undefined;

  const existing = (meta.whatsappActionConfig as WhatsAppActionConfig | undefined) ?? undefined;
  const variableMappings = coerceVariableMappings(existing?.variableMappings ?? meta.variableMappings);

  const sendWindowCandidate = existing?.sendWindow ?? meta.sendWindow;
  const rateLimitCandidate = existing?.rateLimiting ?? meta.rateLimiting;
  const failureCandidate = existing?.failureHandling ?? meta.failureHandling;

  const templateId =
    existing?.templateId ?? (typeof meta.templateId === 'string' ? meta.templateId : '');
  const templateName =
    existing?.templateName ?? (typeof meta.templateName === 'string' ? meta.templateName : '');
  const templateStatus =
    existing?.templateStatus ??
    (typeof meta.templateStatus === 'string' ? (meta.templateStatus as WhatsAppTemplateStatus) : undefined);

  if (!templateId && !templateName && !variableMappings.length && !existing) {
    return undefined;
  }

  return {
    templateId,
    templateName,
    templateStatus,
    templateLanguage:
      existing?.templateLanguage ??
      (typeof meta.templateLanguage === 'string' ? meta.templateLanguage : undefined),
    templateCategory:
      existing?.templateCategory ??
      (typeof meta.templateCategory === 'string' ? meta.templateCategory : undefined),
    variableMappings,
    mediaUrl:
      existing?.mediaUrl ?? (typeof meta.mediaUrl === 'string' ? meta.mediaUrl : undefined),
    useDynamicMedia:
      existing?.useDynamicMedia ??
      (typeof meta.useDynamicMedia === 'boolean' ? meta.useDynamicMedia : undefined),
    sendWindow: isSendWindowConfig(sendWindowCandidate)
      ? sendWindowCandidate
      : DEFAULT_WHATSAPP_SEND_WINDOW,
    rateLimiting: isRateLimitingConfig(rateLimitCandidate)
      ? rateLimitCandidate
      : DEFAULT_WHATSAPP_RATE_LIMIT,
    failureHandling: isFailureHandlingConfig(failureCandidate)
      ? failureCandidate
      : DEFAULT_WHATSAPP_FAILURE_HANDLING,
    skipIfOptedOut:
      existing?.skipIfOptedOut ?? (typeof meta.skipIfOptedOut === 'boolean' ? meta.skipIfOptedOut : true),
    buttonActions: {
      ...(existing?.buttonActions ?? {}),
      ...(typeof meta.buttonActions === 'object' && meta.buttonActions !== null
        ? (meta.buttonActions as Record<string, string>)
        : {}),
    },
    exitPaths: (existing as any)?.exitPaths ?? (meta.exitPaths as any) ?? undefined,
  } as WhatsAppActionConfig;
}

function formatDuration(duration: Duration): string {
  const baseUnit = duration.unit;
  const unit = duration.value === 1 ? baseUnit.replace(/s$/, '') : baseUnit;
  return `${duration.value} ${unit}`;
}

function formatTimeOfDay(time: TimeOfDay, timezone?: string): string {
  const hour12 = time.hour % 12 || 12;
  const minute = time.minute.toString().padStart(2, '0');
  const suffix = time.hour >= 12 ? 'PM' : 'AM';
  const tz = timezone && timezone !== 'customer' ? timezone : 'customer local time';
  return `${hour12}:${minute} ${suffix} (${tz})`;
}

function summariseDelayConfig(config: DelayConfig): string {
  switch (config.delayType) {
    case 'fixed_time': {
      const details = config.specificConfig as FixedTimeDelayConfig;
      return `Wait ${formatDuration(details.duration)}`;
    }
    case 'wait_until_time': {
      const details = config.specificConfig as WaitUntilTimeConfig;
      return `Wait until ${formatTimeOfDay(details.time, details.timezone)}`;
    }
    case 'wait_for_event': {
      const details = config.specificConfig as WaitForEventConfig;
      const eventName = details.eventName || 'selected event';
      return `Wait for ${eventName} (max ${formatDuration(details.maxWaitTime)})`;
    }
    case 'optimal_send_time': {
      const details = config.specificConfig as OptimalSendTimeConfig;
      return `AI window ${formatDuration(details.window.duration)}`;
    }
    case 'wait_for_attribute': {
      const details = config.specificConfig as WaitForAttributeConfig;
      return `Wait for ${details.attributePath || 'attribute'} = ${String(details.targetValue ?? '?')}`;
    }
    default:
      return 'Delay';
  }
}

function summariseGoalConfig(config: GoalConfig | undefined | null): string {
  if (!config) {
    return 'Goal not configured';
  }

  const goalType = config.goalType ?? 'goal';

  switch (goalType) {
    case 'journey_completion':
      return 'Journey completion';
    case 'segment_entry':
      return `Segment entry • ${config.segmentId || 'segment'}`;
    case 'shopify_event':
      return `Shopify event • ${config.eventName || 'event'}`;
    case 'whatsapp_engagement':
      return `WhatsApp engagement • ${config.eventName || 'engagement'}`;
    case 'custom_event':
      return `Custom event • ${config.eventName || 'event'}`;
    default:
      return String(goalType).replace(/_/g, ' ');
  }
}

function summariseExperimentConfig(config: ExperimentConfig): string {
  const primaryGoal = config.goals.find(goal => goal.id === config.primaryGoalId);
  const variantSummary = config.variants
    .map(variant => `${variant.name} ${variant.trafficAllocation.toFixed(1)}%`)
    .join(', ');
  const goalName = primaryGoal?.name ?? 'No primary goal';
  return `${config.variants.length} variants • ${goalName} • ${variantSummary}`;
}

const edgeTypes = { journey: JourneyEdge as any };
const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.1 } as const;
const DEFAULT_EDGE_OPTIONS = { type: 'journey', animated: true } as const;

const jsonEquals = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const USER_PREFERENCES_KEY = 'user:preferences';

const buildJourneyStorageKey = (journeyId: string) => `journey:${journeyId}`;
const buildJourneyDraftKey = (journeyId: string) => `journey:${journeyId}:draft`;
const buildJourneyStatsKey = (journeyId: string) => `journey:${journeyId}:stats`;

interface JourneyDraftSnapshot {
  id: string;
  name: string;
  status: BuilderStatus;
  settings: JourneyDefinition['settings'];
  nodes: Node<JourneyNodeData>[];
  edges: Edge[];
  updatedAt: number;
}

const defaultSettings: JourneyDefinition['settings'] = {
  entry: {
    frequency: 'once',
  },
  exit: {
    onGoal: true,
  },
  allowReentry: false,
  reentryCooldownDays: undefined,
  testMode: false,
  testPhoneNumbers: [],
};

type JourneySavePayload = {
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  settings: JourneyDefinition['settings'];
  nodes: JourneyNode[];
  edges: JourneyEdgeType[];
};

type Debounced<T extends (...args: unknown[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

const defaultJourneyConfig: JourneyConfig = {
  reEntryRules: {
    allow: false,
    cooldownDays: 0,
  },
  maxEnrollments: null,
  timezone: 'UTC',
};

const defaultJourneyStats: JourneyStats = {
  totalEnrollments: 0,
  activeEnrollments: 0,
  completedEnrollments: 0,
  goalConversionRate: 0,
};

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  }) as Debounced<T>;
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

interface DeleteConfirmState {
  isOpen: boolean;
  nodeId: string | null;
  nodeName: string;
}

interface JourneyProgressState {
  testUser: TestUser;
  currentNode: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  lastActionAt: string;
}

interface TestUsersApiResponse {
  testUsers?: TestUser[];
  error?: string;
}

interface TestExecutionsApiResponse {
  progress?: JourneyProgressState[];
  logs?: JourneyExecutionLog[];
  error?: string;
}

type ActiveModalState =
  | { type: 'trigger'; nodeId: string }
  | { type: 'whatsapp'; nodeId: string; step?: StepId }
  | { type: 'delay'; nodeId: string }
  | { type: 'condition'; nodeId: string }
  | { type: 'goal'; nodeId: string }
  | { type: 'experiment'; nodeId: string }
  | null;

type ToolbarNodeKind = 'trigger' | 'action' | 'delay' | 'condition' | 'experiment' | 'goal';

interface ToolbarAddConfig {
  nodeType: ToolbarNodeKind;
  subtype: string;
  label?: string;
  description?: string;
  meta?: Record<string, unknown>;
  toastMessage?: string;
}

const triggerSubtypeToType: Record<string, JourneyTriggerType> = {
  segment_joined: 'segment',
  event_trigger: 'webhook',
  unified_trigger: 'webhook',
  order_placed: 'order_placed',
  cart_abandoned: 'abandoned_cart',
  product_viewed: 'product_viewed',
  date_time: 'custom_date',
  manual_entry: 'manual',
  abandoned_cart: 'abandoned_cart',
};

const triggerTypeToSubtype: Record<JourneyTriggerType, string> = {
  segment: 'segment_joined',
  product_viewed: 'product_viewed',
  order_placed: 'order_placed',
  abandoned_cart: 'cart_abandoned',
  tag_added: 'event_trigger',
  first_purchase: 'event_trigger',
  repeat_purchase: 'event_trigger',
  birthday: 'date_time',
  custom_date: 'date_time',
  webhook: 'event_trigger',
  manual: 'manual_entry',
};

const formatUnifiedTriggerTimeFrameLabel = (timeFrame?: UnifiedTriggerRule['timeFrame']): string | undefined => {
  if (!timeFrame) return undefined;
  switch (timeFrame.period) {
    case 'last_24_hours':
      return 'Last 24 hours';
    case 'last_7_days':
      return 'Last 7 days';
    case 'last_30_days':
      return 'Last 30 days';
    case 'custom':
      return timeFrame.customDays
        ? `Last ${timeFrame.customDays} day${timeFrame.customDays === 1 ? '' : 's'}`
        : 'Custom window';
    default:
      return undefined;
  }
};

const isValidTriggerConfig = (config: unknown): config is UnifiedTriggerConfig => {
  if (!config || typeof config !== 'object') return false;
  const maybeConfig = config as UnifiedTriggerConfig;
  const segment = maybeConfig.targetSegment;
  if (!segment) return false;
  if (!Array.isArray(segment.rules)) return false;
  return true;
};

const buildUnifiedTriggerSummary = (config: UnifiedTriggerConfig): string | undefined => {
  if (!isValidTriggerConfig(config) || (config.targetSegment?.rules?.length ?? 0) === 0) {
    return 'Configure trigger';
  }

  const primaryRule = config.targetSegment?.rules?.[0];
  if (!primaryRule) return 'Configure trigger';

  const summaryParts: string[] = [];
  const eventName = (primaryRule.eventName ?? '').trim();
  if (eventName) {
    summaryParts.push(eventName.replace(/_/g, ' '));
  }
  const timeframe = formatUnifiedTriggerTimeFrameLabel(primaryRule.timeFrame);
  if (timeframe) {
    summaryParts.push(timeframe);
  }
  if (Array.isArray(primaryRule.conditions) && primaryRule.conditions.length > 0) {
    summaryParts.push(
      `${primaryRule.conditions.length} filter${primaryRule.conditions.length === 1 ? '' : 's'}`
    );
  }
  const summary = summaryParts.join(' • ');
  if (summary) {
    return summary;
  }
  return config.segmentName ?? 'Trigger configured';
};

const DEFAULT_ENTRY_FREQUENCY: EntryFrequencySettings = {
  allowReentry: false,
  cooldown: null,
  entryLimit: null,
};

const DEFAULT_ENTRY_WINDOW: EntryWindowSettings = {
  startsAt: null,
  endsAt: null,
  timezone: 'UTC',
};

function deepClone<T>(value: T): T {
  if (value == null) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (error) {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cleanUndefined(record: JsonMap): JsonMap {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined)
  ) as JsonMap;
}

function normaliseDuration(value?: DurationValue | null): DurationValue | null {
  if (!value) return null;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    unit: value.unit ?? 'days',
  };
}

function normaliseEntryFrequency(value?: Partial<EntryFrequencySettings> | null): EntryFrequencySettings {
  const base = deepClone(DEFAULT_ENTRY_FREQUENCY);
  if (!value) return base;
  return {
    allowReentry: Boolean(value.allowReentry),
    cooldown: normaliseDuration(value.cooldown ?? null),
    entryLimit: value.entryLimit != null ? Number(value.entryLimit) : null,
  };
}

function normaliseEntryWindow(value?: Partial<EntryWindowSettings> | null): EntryWindowSettings {
  const base = deepClone(DEFAULT_ENTRY_WINDOW);
  if (!value) return base;
  return {
    startsAt: value.startsAt ?? null,
    endsAt: value.endsAt ?? null,
    timezone: value.timezone || base.timezone,
  };
}

function normaliseTriggerConfiguration(config: JourneyTriggerConfiguration): JourneyTriggerConfiguration {
  const cloned = deepClone(config);
  cloned.entryFrequency = normaliseEntryFrequency(cloned.entryFrequency);
  cloned.entryWindow = normaliseEntryWindow(cloned.entryWindow);

  switch (cloned.category) {
    case 'segment': {
      const segment: Partial<SegmentTriggerConfig> = cloned.segment ?? {};
      cloned.segment = {
        mode: segment.mode === 'exit' ? 'exit' : 'enter',
        segmentId: segment.segmentId,
        segmentName: segment.segmentName,
        estimatedAudience: segment.estimatedAudience ?? null,
      };
      break;
    }
    case 'shopify_event': {
      const shopify: Partial<ShopifyEventTriggerConfig> = cloned.shopifyEvent ?? {};
      cloned.shopifyEvent = {
        eventType: shopify.eventType ?? 'order_placed',
        productSelection: shopify.productSelection ?? { mode: 'any', productIds: [], collectionIds: [] },
        filters: shopify.filters,
        advanced: shopify.advanced,
      };
      break;
    }
    case 'time_based': {
      const time = cloned.timeBased ?? { type: 'specific_datetime' as const };
      if (time.type === 'specific_datetime') {
        cloned.timeBased = {
          type: 'specific_datetime',
          startsAt: time.startsAt ?? '',
          timezone: time.timezone || 'UTC',
        };
      } else if (time.type === 'recurring_schedule') {
        cloned.timeBased = {
          type: 'recurring_schedule',
          cadence: time.cadence ?? 'weekly',
          daysOfWeek: Array.isArray(time.daysOfWeek) && time.daysOfWeek.length ? time.daysOfWeek : ['monday'],
          dayOfMonth: time.dayOfMonth ?? null,
          timeOfDay: time.timeOfDay ?? '09:00',
          timezone: time.timezone || 'UTC',
        };
      } else {
        cloned.timeBased = {
          type: 'attribute_date',
          attributeKey: time.attributeKey ?? '',
          offset: time.offset ?? { amount: 0, unit: 'days' },
          timezoneBehavior: time.timezoneBehavior ?? 'customer',
          fallbackTime: time.fallbackTime ?? '09:00',
        };
      }
      break;
    }
    case 'manual':
    default: {
      const manual: Partial<ManualTriggerConfig> = cloned.manual ?? {};
      cloned.manual = {
        mode: manual.mode ?? 'api',
        notes: manual.notes,
      };
      break;
    }
  }

  return cloned;
}

function ensureTriggerConfiguration(meta: JsonMap, node?: JourneyNode): JourneyTriggerConfiguration {
  const rawConfig = meta?.triggerConfiguration;
  if (rawConfig && typeof rawConfig === 'object') {
    return normaliseTriggerConfiguration(rawConfig as JourneyTriggerConfiguration);
  }

  const nodeTrigger = node && node.type === 'trigger' ? node : undefined;
  const inferredSubtype = (meta?.triggerType as string) || node?.subtype || 'segment_joined';
  const triggerType = toTriggerType(inferredSubtype);

  const entryFrequency = normaliseEntryFrequency(meta?.entryFrequency as Partial<EntryFrequencySettings> | null | undefined);
  const entryWindow = normaliseEntryWindow(meta?.entryWindow as Partial<EntryWindowSettings> | null | undefined);
  const estimate = meta?.estimate ? (deepClone(meta.estimate) as AudienceEstimate) : undefined;

  let config: JourneyTriggerConfiguration;

  switch (triggerType) {
    case 'segment': {
      const segmentId = (meta?.segmentId as string | undefined) ?? nodeTrigger?.trigger?.segmentId;
      config = {
        category: 'segment',
        segment: {
          mode: meta?.segmentMode === 'exit' ? 'exit' : 'enter',
          segmentId,
          segmentName: meta?.segmentName as string | undefined,
          estimatedAudience:
            typeof meta?.previewCount === 'number'
              ? meta.previewCount
              : typeof estimate?.totalAudience === 'number'
                ? estimate.totalAudience
                : null,
        },
        entryFrequency,
        entryWindow,
        estimate,
      };
      break;
    }
    case 'order_placed':
    case 'abandoned_cart':
    case 'product_viewed':
    case 'webhook': {
      const nodeShopify: Partial<ShopifyEventTriggerConfig> = (nodeTrigger?.data?.shopifyEvent as ShopifyEventTriggerConfig | undefined) ?? {};
      const shopifyMeta = meta?.shopifyEvent as ShopifyEventTriggerConfig | undefined;
      const eventType =
        (shopifyMeta?.eventType as ShopifyEventTriggerConfig['eventType']) ||
        (nodeShopify?.eventType as ShopifyEventTriggerConfig['eventType']) ||
        (triggerType === 'abandoned_cart'
          ? 'cart_abandoned'
          : triggerType === 'product_viewed'
            ? 'product_viewed'
            : 'order_placed');

      config = {
        category: 'shopify_event',
        shopifyEvent: {
          eventType,
          productSelection: (shopifyMeta?.productSelection ?? nodeShopify?.productSelection ?? (meta?.productSelection as ProductSelectionConfig | undefined) ?? {
            mode: 'any',
            productIds: [],
            collectionIds: [],
          }) as ProductSelectionConfig,
          filters: shopifyMeta?.filters ?? nodeShopify?.filters,
          advanced: shopifyMeta?.advanced ?? nodeShopify?.advanced,
        },
        entryFrequency,
        entryWindow,
        estimate,
      };
      break;
    }
    case 'custom_date':
    case 'birthday': {
      const timeBased =
        (meta?.timeBased as TimeBasedTriggerConfig | undefined) ??
        (nodeTrigger?.data?.timeBased as TimeBasedTriggerConfig | undefined);
      const attributeDate = meta?.attributeDate as TimeBasedTriggerConfig | undefined;
      const recurring = meta?.recurringSchedule as TimeBasedTriggerConfig | undefined;
      let resolved: TimeBasedTriggerConfig | undefined =
        timeBased ??
        attributeDate ??
        recurring;

      if (!resolved) {
        if (meta?.scheduledAt) {
          resolved = {
            type: 'specific_datetime',
            startsAt: String(meta.scheduledAt ?? ''),
            timezone: (meta.timezone as string) || 'UTC',
          };
        } else {
          resolved = {
            type: 'specific_datetime',
            startsAt: '',
            timezone: 'UTC',
          };
        }
      }

      config = {
        category: 'time_based',
        timeBased: resolved,
        entryFrequency,
        entryWindow,
        estimate,
      };
      break;
    }
    case 'manual':
    default: {
      const manual = (meta?.manualTrigger as ManualTriggerConfig | undefined) ?? (nodeTrigger?.data?.manual as ManualTriggerConfig | undefined);
      config = {
        category: 'manual',
        manual: {
          mode: manual?.mode ?? 'api',
          notes: manual?.notes,
        },
        entryFrequency,
        entryWindow,
        estimate,
      };
      break;
    }
  }

  return normaliseTriggerConfiguration(config);
}

function buildLegacyMetaFromConfig(config: JourneyTriggerConfiguration): JsonMap {
  const legacy = cleanUndefined({
    triggerConfiguration: config,
    triggerType:
      config.category === 'segment'
        ? config.segment?.mode === 'exit'
          ? 'segment_exited'
          : 'segment_joined'
        : config.category === 'shopify_event'
          ? config.shopifyEvent?.eventType
          : config.category === 'time_based'
            ? config.timeBased?.type
            : 'manual_entry',
    entryFrequency: deepClone(config.entryFrequency),
    entryWindow: deepClone(config.entryWindow),
    estimate: config.estimate ? deepClone(config.estimate) : undefined,
  });

  switch (config.category) {
    case 'segment': {
      const segment: Partial<SegmentTriggerConfig> = config.segment ?? {};
      legacy.segmentId = segment.segmentId;
      legacy.segmentName = segment.segmentName;
      legacy.segmentMode = segment.mode ?? 'enter';
      if (segment.estimatedAudience != null) {
        legacy.previewCount = segment.estimatedAudience;
      } else if (config.estimate?.totalAudience != null) {
        legacy.previewCount = config.estimate.totalAudience;
      }
      break;
    }
    case 'shopify_event': {
      const shopify = config.shopifyEvent ?? { eventType: 'order_placed' as ShopifyEventTriggerConfig['eventType'] };
      legacy.shopifyEvent = deepClone(shopify);
      legacy.productSelection = deepClone(shopify.productSelection);
      break;
    }
    case 'time_based': {
      const time = config.timeBased;
      legacy.timeBased = deepClone(time);
      if (time?.type === 'specific_datetime') {
        legacy.triggerType = 'date_time';
        legacy.scheduledAt = time.startsAt;
        legacy.timezone = time.timezone;
      } else if (time?.type === 'recurring_schedule') {
        legacy.triggerType = 'recurring_schedule';
        legacy.recurringSchedule = deepClone(time);
      } else if (time?.type === 'attribute_date') {
        legacy.triggerType = 'attribute_date';
        legacy.attributeDate = deepClone(time);
      }
      break;
    }
    case 'manual':
    default: {
      legacy.triggerType = 'manual_entry';
      legacy.manualTrigger = deepClone(config.manual);
      break;
    }
  }

  return legacy;
}

type TriggerPayload = TriggerNode['trigger'];

function deriveTriggerPayload(config: JourneyTriggerConfiguration): { trigger: TriggerPayload; subtype: string } {
  switch (config.category) {
    case 'segment': {
      const segment: Partial<SegmentTriggerConfig> = config.segment ?? {};
      return {
        trigger: {
          type: 'segment' as JourneyTriggerType,
          segmentId: segment.segmentId,
        },
        subtype: 'segment_joined',
      };
    }
    case 'shopify_event': {
      const shopify = config.shopifyEvent ?? { eventType: 'order_placed' as ShopifyEventTriggerConfig['eventType'] };
      const eventType = shopify.eventType;
      let triggerType: JourneyTriggerType;
      let subtype: string;
      switch (eventType) {
        case 'cart_abandoned':
          triggerType = 'abandoned_cart';
          subtype = 'cart_abandoned';
          break;
        case 'product_viewed':
          triggerType = 'product_viewed';
          subtype = 'product_viewed';
          break;
        case 'order_placed':
          triggerType = 'order_placed';
          subtype = 'order_placed';
          break;
        default:
          triggerType = 'webhook';
          subtype = 'event_trigger';
          break;
      }
      return {
        trigger: cleanUndefined({
          type: triggerType,
          data: {
            shopifyEvent: deepClone(shopify),
          },
        }) as TriggerPayload,
        subtype,
      };
    }
    case 'time_based': {
      const time = config.timeBased;
      return {
        trigger: cleanUndefined({
          type: 'custom_date' as JourneyTriggerType,
          data: {
            timeBased: deepClone(time),
          },
        }) as TriggerPayload,
        subtype: 'date_time',
      };
    }
    case 'manual':
    default: {
      return {
        trigger: cleanUndefined({
          type: 'manual' as JourneyTriggerType,
          data: {
            manual: deepClone(config.manual),
          },
        }) as TriggerPayload,
        subtype: 'manual_entry',
      };
    }
  }
}

function toTriggerType(subtype?: string): JourneyTriggerType {
  if (!subtype) return 'manual';
  return triggerSubtypeToType[subtype] ?? 'manual';
}

function toTriggerSubtype(type?: JourneyTriggerType): string {
  if (!type) return 'manual_entry';
  return triggerTypeToSubtype[type] ?? 'manual_entry';
}

function hourStringToNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const [h] = value.split(':');
  const num = Number(h);
  return Number.isFinite(num) ? num : undefined;
}

function numberToHourString(value?: number): string | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  const hours = Math.max(0, Math.min(23, Math.round(value)));
  return `${hours.toString().padStart(2, '0')}:00`;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

function normaliseJourneyStructure(journey: JourneyDefinition): JourneyDefinition {
  const config: JourneyConfig = {
    ...defaultJourneyConfig,
    ...(journey.config || {}),
    reEntryRules: {
      ...defaultJourneyConfig.reEntryRules,
      ...(journey.config?.reEntryRules || {}),
    },
  };

  if (config.maxEnrollments !== null) {
    const numeric = Number(config.maxEnrollments);
    config.maxEnrollments = Number.isFinite(numeric) ? numeric : null;
  }

  const stats: JourneyStats = {
    ...defaultJourneyStats,
    ...(journey.stats || {}),
  };

  const createdAt = journey.createdAt ?? new Date().toISOString();
  const updatedAt = journey.updatedAt ?? createdAt;

  const settings: JourneyDefinition['settings'] = {
    ...(defaultSettings ?? {}),
    ...(journey.settings || {}),
    entry: {
      ...(defaultSettings?.entry ?? {}),
      ...(journey.settings?.entry || {}),
      frequency: (defaultSettings?.entry?.frequency ?? journey.settings?.entry?.frequency) ?? 'once',
    },
    exit: {
      ...(defaultSettings?.exit ?? {}),
      ...(journey.settings?.exit || {}),
    },
    timezone: journey.settings?.timezone || config.timezone || defaultJourneyConfig.timezone,
    allowReentry:
      journey.settings?.allowReentry ??
      (config.reEntryRules?.allow ?? defaultJourneyConfig.reEntryRules.allow),
    reentryCooldownDays:
      journey.settings?.reentryCooldownDays ??
      (config.reEntryRules?.cooldownDays ?? defaultJourneyConfig.reEntryRules.cooldownDays),
    testMode: journey.settings?.testMode ?? false,
    testPhoneNumbers: journey.settings?.testPhoneNumbers ?? [],
  };

  return {
    ...journey,
    createdAt,
    updatedAt,
    settings,
    config,
    stats,
  };
}

function buildMetaFromNode(node: JourneyNode): JsonMap {
  const baseData = (node.data ?? {}) as JsonMap;
  const meta: JsonMap = { ...baseData };

  switch (node.type) {
    case 'trigger': {
      const config = ensureTriggerConfiguration(meta, node);
      const legacyMeta = buildLegacyMetaFromConfig(config);
      Object.assign(meta, legacyMeta);
      break;
    }
    case 'action': {
      const action = node.type === 'action' ? node.action : undefined;
      if (action) {
        meta.templateName = action.templateName;
        meta.templateLanguage = action.language;
        meta.variables = action.variables;
        meta.fallbackText = action.fallbackText;
        if (action.sendWindow) {
          meta.sendWindowStart = numberToHourString(action.sendWindow.startHour);
          meta.sendWindowEnd = numberToHourString(action.sendWindow.endHour);
        }
      }
      // Extract exit paths from node config if it's a WhatsApp action
      const whatsappConfig = (node.data?.whatsappActionConfig as any) || 
                            (node.data?.config as any);
      if (whatsappConfig?.exitPaths) {
        meta.exitPaths = whatsappConfig.exitPaths;
      }
      break;
    }
    case 'delay': {
      const delay = node.type === 'delay' ? node.delay : undefined;
      if (delay) {
        meta.unit = delay.unit;
        meta.duration = delay.value;
      }
      break;
    }
    case 'condition': {
      const condition = node.type === 'condition' ? node.condition : undefined;
      if (condition) {
        meta.conditionType = condition.kind;
        meta.args = condition.args;
      }
      break;
    }
    case 'goal': {
      const goalConfig =
        (node.data?.goalConfig as GoalConfig | undefined) ??
        (node.type === 'goal' ? node.goal : undefined) ?? undefined;
      if (goalConfig && 'goalType' in goalConfig) {
        const gc = goalConfig as GoalConfig;
        meta.goalConfig = gc;
        meta.goalType = gc.goalType;
        meta.goalName = gc.goalName;
        meta.goalDescription = gc.goalDescription;
        meta.goalCategory = gc.goalCategory;
        meta.attributionWindow = gc.attributionWindow;
        meta.attributionModel = gc.attributionModel;
        meta.exitAfterGoal = gc.exitAfterGoal;
        meta.markAsCompleted = gc.markAsCompleted;
        meta.countMultipleConversions = gc.countMultipleConversions;
        meta.goalSummary = summariseGoalConfig(gc);
      }
      break;
    }
    default:
      break;
  }

  return meta;
}

function createJourneyNodeFromFlow(node: Node<JourneyNodeData>): JourneyNode {
  const meta: JsonMap = { ...(node.data.meta || {}) };
  const base: MutableJourneyNode = {
    id: node.id,
    type: (() => {
      switch (node.data.variant) {
        case 'trigger':
          return 'trigger';
        case 'action':
          return 'action';
        case 'decision':
          return 'condition';
        case 'experiment':
          return 'condition';
        case 'wait':
          return 'delay';
        case 'goal':
          return node.data.subtype === 'exit_journey' ? 'exit' : 'goal';
        default:
          return 'goal';
      }
    })(),
    position: node.position,
    name: node.data.label,
    description: node.data.description,
    data: meta,
  };

  if (base.type === 'trigger') {
    const config = ensureTriggerConfiguration(meta, node as unknown as JourneyNode);
    const legacyMeta = buildLegacyMetaFromConfig(config);
    const { trigger, subtype } = deriveTriggerPayload(config);
    base.subtype = subtype;
    base.trigger = trigger;
    const mergedMeta = cleanUndefined({
      ...meta,
      ...legacyMeta,
    });
    if (isUnifiedTriggerEnabled()) {
      const unifiedMeta = cleanUndefined({
        ...mergedMeta,
        triggerConfig: node.data.triggerConfig,
        triggerConfiguration: node.data.triggerConfig,
        status: node.data.status,
        userCount: node.data.userCount,
      });
      base.data = unifiedMeta;
    } else {
      base.data = mergedMeta;
    }
  } else if (base.type === 'action') {
    base.subtype = node.data.subtype || 'send_whatsapp';
    base.action = {
      kind: 'whatsapp_template',
      templateName: String(meta.templateName ?? node.data.label ?? 'WhatsApp Template'),
      language: String(meta.templateLanguage ?? 'en'),
      variables: (meta.variables || {}) as Record<string, string>,
      fallbackText: meta.fallbackText as string | undefined,
      sendWindow:
        meta.sendWindowStart || meta.sendWindowEnd
          ? {
              startHour: hourStringToNumber(meta.sendWindowStart as string | undefined) ?? 9,
              endHour: hourStringToNumber(meta.sendWindowEnd as string | undefined) ?? 21,
            }
          : undefined,
    };
  } else if (base.type === 'delay') {
    const delayMode = (meta.delayMode as string) || 'fixed';
    base.subtype = node.data.subtype || (delayMode === 'event' ? 'wait_for_event' : delayMode === 'until' ? 'wait_until' : 'fixed_delay');
    base.delay = {
      unit: (meta.unit as 'hours' | 'days' | 'minutes' | undefined) || 'hours',
      value: Number(meta.duration ?? 24),
    };
  } else if (base.type === 'condition') {
    if (node.data.variant === 'experiment') {
      base.subtype = 'ab_test';
      base.condition = undefined;
    } else {
      base.subtype = node.data.subtype || 'if_else';
      base.condition = {
        kind: ((meta.conditionType as 'opened_message' | 'clicked_link' | 'made_purchase' | 'has_tag' | 'total_spent_gt' | 'order_count' | 'product_purchased' | 'custom_condition' | undefined) || 'custom_condition'),
        args: {
          join: meta.conditionJoin || 'all',
          conditions: meta.conditions || [],
          trueLabel: meta.trueLabel,
          falseLabel: meta.falseLabel,
        },
      };
    }
  } else if (base.type === 'goal') {
    base.subtype = node.data.subtype || 'goal_achieved';
    const goalConfig = (meta.goalConfig as GoalConfig | undefined) ?? (node.data.goalConfig as GoalConfig | undefined);
    if (goalConfig) {
      base.goal = {
        description: goalConfig.goalDescription || goalConfig.goalName,
      };
      base.data = {
        ...meta,
        goalConfig,
      };
    } else {
      base.goal = {
        description: (meta.goalDescription as string | undefined) || (meta.goalName as string | undefined) || node.data.description,
      };
    }
  } else if (base.type === 'exit') {
    base.subtype = node.data.subtype || 'exit_journey';
  }

  return base as JourneyNode;
}

function mapDomainNodeToFlow(node: JourneyNode): Node<JourneyNodeData> {
  const inferredSubtype = (() => {
    if (node.subtype) return node.subtype as string;
    if (node.type === 'trigger') {
      const triggerType = node.trigger?.type;
      switch (triggerType) {
        case 'segment':
          return 'segment_joined';
        case 'manual':
          return 'manual_entry';
        case 'abandoned_cart':
          return node.subtype || 'cart_abandoned';
        case 'order_placed':
          return node.subtype || 'order_placed';
        case 'birthday':
        case 'custom_date':
          return 'date_time';
        case 'webhook':
          return node.subtype || 'event_trigger';
        default:
          return triggerType;
      }
    }
    if (node.type === 'action') {
      const kind = node.action?.kind;
      if (kind === 'whatsapp_template') return 'send_whatsapp';
      if (kind === 'add_tag') return 'add_tag';
      if (kind === 'update_property') return 'update_property';
    }
    if (node.type === 'delay') {
      return node.subtype || 'fixed_delay';
    }
    if (node.type === 'condition') {
      return node.condition?.kind || 'if_else';
    }
    if (node.type === 'goal') {
      return node.subtype || 'goal_achieved';
    }
    return node.subtype;
  })();

  const catalogNode = JOURNEY_NODE_CATALOG.flatMap(category => category.nodes).find(
    item => item.subtype === inferredSubtype
  );

  const variant = (() => {
    switch (node.type) {
      case 'trigger':
        return 'trigger';
      case 'action':
        return 'action';
      case 'condition':
        return node.subtype === 'ab_test' ? 'experiment' : 'decision';
      case 'delay':
        return 'wait';
      case 'exit':
      case 'goal':
      default:
        return 'goal';
    }
  })();

  const meta = buildMetaFromNode(node as JourneyNode);

  const data: JourneyNodeData = {
    label: node.name || catalogNode?.name || 'Node',
    description: node.description || catalogNode?.description,
    variant,
    subtype: inferredSubtype,
    icon: catalogNode?.icon,
    meta,
  };

  if (variant === 'trigger' && isUnifiedTriggerEnabled()) {
    const existingConfig =
      ((node as { data?: { triggerConfig?: UnifiedTriggerConfig } }).data?.triggerConfig as UnifiedTriggerConfig | undefined) ??
      (meta.triggerConfiguration as UnifiedTriggerConfig | undefined) ??
      (meta.triggerConfig as UnifiedTriggerConfig | undefined) ??
      convertLegacyTriggerMetaToUnified(meta);
    if (existingConfig) {
      data.triggerConfig = existingConfig;
      let triggerSummary: string | undefined;
      try {
        triggerSummary = buildUnifiedTriggerSummary(existingConfig);
      } catch (error) {
        console.error('Error building trigger summary:', error);
        triggerSummary = 'Configure trigger';
      }

      data.meta = {
        ...meta,
        triggerConfiguration: existingConfig,
        conditionSummary: meta.conditionSummary ?? triggerSummary,
      };
    } else {
      data.meta = {
        ...meta,
        conditionSummary: meta.conditionSummary ?? 'Configure trigger',
      };
    }
    const existingStatus =
      ((node as { data?: { status?: 'draft' | 'active' } }).data?.status as 'draft' | 'active' | undefined) ??
      (meta.status as 'draft' | 'active' | undefined);
    if (existingStatus) {
      data.status = existingStatus;
    }
    const existingUserCount =
      ((node as { data?: { userCount?: number } }).data?.userCount as number | undefined) ??
      (meta.userCount as number | undefined);
    if (typeof existingUserCount === 'number') {
      data.userCount = existingUserCount;
    }
  }

  return {
    id: node.id,
    type: variant,
    position: node.position || { x: 0, y: 0 },
    data,
    dragHandle: '.react-flow__node',
    style: {
      width: 280,
    },
  } satisfies Node<JourneyNodeData>;
}

function mapDomainEdgeToFlow(edge: JourneyEdgeType): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'journey',
    markerEnd: { type: 'arrowclosed', color: '#9CA3AF', width: 20, height: 20 },
    data: {},
  };
}

function mapFlowNodeToDomain(node: Node<JourneyNodeData>): JourneyNode {
  return createJourneyNodeFromFlow(node);
}

function mapFlowEdgeToDomain(edge: Edge): JourneyEdgeType {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  };
}

function JourneyBuilderInner({ journeyId }: JourneyBuilderInnerProps) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initialised, setInitialised] = useState(false);
  const [journeyName, setJourneyName] = useState('');
  const [journeyStatus, setJourneyStatus] = useState<BuilderStatus>('draft');
  const [journeySettings, setJourneySettings] = useState<JourneyDefinition['settings']>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [journey, setJourney] = useState<JourneyDefinition | null>(null);
  const journeyRef = useRef<JourneyDefinition | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [testUsersPanelOpen, setTestUsersPanelOpen] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState<JourneyProgressState[]>([]);
  const [executionLogs, setExecutionLogs] = useState<JourneyExecutionLog[]>([]);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'builder' | 'analytics'>('builder');
  const [isExecutionLoading, setIsExecutionLoading] = useState(false);
  const [executionLogModal, setExecutionLogModal] = useState<{ open: boolean; testUserId?: string }>({ open: false });
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ isOpen: false, nodeId: null, nodeName: '' });
  const [activeModal, setActiveModal] = useState<ActiveModalState>(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
  const [lastValidationAt, setLastValidationAt] = useState<Date | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setLeftSidebarOpen(false);
        setRightPanelOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-open right panel when node is selected on mobile
  useEffect(() => {
    if (isMobile && selectedNodeId) {
      setRightPanelOpen(true);
    }
  }, [selectedNodeId, isMobile]);
  const [isValidating, setIsValidating] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<'activate' | null>(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  const testUsersRetryRef = useRef(0);
  const executionRetryRef = useRef(0);

  const closeActiveModal = useCallback(() => setActiveModal(null), []);

  const toggleSidebarPanel = useCallback(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsSidebarCollapsed(false);
    } else {
      panel.collapse();
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleInspectorPanel = useCallback(() => {
    const panel = inspectorPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsInspectorCollapsed(false);
    } else {
      panel.collapse();
      setIsInspectorCollapsed(true);
    }
  }, []);

  const unifiedTriggerEnabled = useMemo(() => isUnifiedTriggerEnabled(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<JourneyNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const nodesRef = useRef<Node<JourneyNodeData>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const journeyStatusRef = useRef<BuilderStatus>('draft');
  const journeySettingsRef = useRef<JourneyDefinition['settings']>(defaultSettings);
  const viewportRef = useRef<Viewport | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle | null>(null);
  const inspectorPanelRef = useRef<ImperativePanelHandle | null>(null);
  const reactFlow = useReactFlow<Node<JourneyNodeData>>();
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<Node<JourneyNodeData>> | null>(null);
  const journeyFetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (panel && !panel.isCollapsed()) {
      panel.collapse();
    }
    setIsSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    const panel = inspectorPanelRef.current;
    if (panel) {
      setIsInspectorCollapsed(panel.isCollapsed());
    }
  }, []);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const panel = inspectorPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsInspectorCollapsed(false);
    }
  }, [selectedNodeId]);
  const applyJourney = useCallback(
    (hydratedJourney: JourneyDefinition) => {
      setJourney(hydratedJourney);
      setJourneyName(hydratedJourney.name || 'Untitled Journey');
      setJourneyStatus(
        hydratedJourney.status === 'ACTIVE' ? 'active' : hydratedJourney.status === 'PAUSED' ? 'paused' : 'draft',
      );
      setJourneySettings({
        ...(defaultSettings ?? {}),
        ...(hydratedJourney.settings || {}),
        entry: {
          ...(defaultSettings?.entry ?? {}),
          ...(hydratedJourney.settings?.entry || {}),
          frequency: (defaultSettings?.entry?.frequency ?? hydratedJourney.settings?.entry?.frequency) ?? 'once',
        },
        exit: {
          ...(defaultSettings?.exit ?? {}),
          ...(hydratedJourney.settings?.exit || {}),
        },
      });
      setLastSavedAt(hydratedJourney.updatedAt ? new Date(hydratedJourney.updatedAt) : new Date());
      setNodes(hydratedJourney.nodes?.map(mapDomainNodeToFlow) ?? []);
      setEdges(hydratedJourney.edges?.map(mapDomainEdgeToFlow) ?? []);
      setJourneyError(null);
    },
    [setEdges, setJourney, setJourneyName, setJourneySettings, setJourneyStatus, setLastSavedAt, setNodes],
  );
  const fetchJourney = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!journeyId) {
        const message = 'Journey ID missing.';
        setJourneyError(message);
        setLoading(false);
        setInitialised(true);
        return false;
      }

      journeyFetchControllerRef.current?.abort();
      const controller = new AbortController();
      journeyFetchControllerRef.current = controller;

      if (!silent) {
        setLoading(true);
      }

      setJourneyError(null);

      try {
        const response = await fetch(`/api/journeys/${journeyId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `Failed to load journey (status ${response.status})`);
        }

        const payload = await response.json().catch(() => null);
        if (!payload || !payload.journey) {
          throw new Error('Journey payload missing.');
        }

        const domainJourney = payload.journey as JourneyDefinition;
        const hydratedJourney = normaliseJourneyStructure(domainJourney);
        applyJourney(hydratedJourney);

        if (typeof window !== 'undefined') {
          const storage = getWindowStorage();
          storage.setJSON(buildJourneyStorageKey(journeyId), hydratedJourney);
          if (hydratedJourney.stats) {
            storage.setJSON(buildJourneyStatsKey(journeyId), hydratedJourney.stats);
          }
        }

        return true;
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return false;
        }
        const message = fallbackMessage(error, 'Unable to load journey.');
        console.error('[JourneyBuilder] Failed to load journey', error);
        setJourneyError(message);
        toast.error(message);
        return false;
      } finally {
        if (!controller.signal.aborted) {
          if (!silent) {
            setLoading(false);
          }
          setInitialised(true);
        }
      }
    },
    [journeyId, applyJourney, toast],
  );
  useEffect(() => {
    setIsCanvasReady(false);
  }, [journeyId]);
  const lastSnapshotRef = useRef<string>('');
  const executionLoadingRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTestModePollAtRef = useRef(0);

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    journeyStatusRef.current = journeyStatus;
  }, [journeyStatus]);

  useEffect(() => {
    journeySettingsRef.current = journeySettings;
  }, [journeySettings]);

  useEffect(() => {
    if (!initialised || typeof window === 'undefined' || !journeyId) return;
    const storage = getWindowStorage();
    const snapshot: JourneyDraftSnapshot = {
      id: journeyId,
      name: journeyName,
      status: journeyStatus,
      settings: journeySettings,
      nodes,
      edges,
      updatedAt: Date.now(),
    };
    storage.setJSON(buildJourneyDraftKey(journeyId), snapshot);
  }, [initialised, journeyId, journeyName, journeyStatus, journeySettings, nodes, edges]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!journeyId) {
      setLoading(false);
      setInitialised(true);
      setJourneyError('Journey ID missing.');
      return undefined;
    }

    let hasCache = false;

    if (typeof window !== 'undefined') {
      const storage = getWindowStorage();
      const draft = storage.getJSON<JourneyDraftSnapshot>(buildJourneyDraftKey(journeyId));
      const storedJourney = storage.getJSON<JourneyDefinition>(buildJourneyStorageKey(journeyId));

      if (draft && Array.isArray(draft.nodes) && Array.isArray(draft.edges)) {
        setJourneyName(draft.name || 'Untitled Journey');
        setJourneyStatus(draft.status || 'draft');
        setJourneySettings(draft.settings || defaultSettings);
        setNodes(draft.nodes.map(rehydrateFlowNode));
        setEdges(draft.edges);
        if (draft.updatedAt) {
          setLastSavedAt(new Date(draft.updatedAt));
        }
        hasCache = true;
        setInitialised(true);
        setLoading(false);
        setJourneyError(null);
      } else if (storedJourney) {
        const hydratedStored = normaliseJourneyStructure(storedJourney);
        applyJourney(hydratedStored);
        hasCache = true;
        setInitialised(true);
        setLoading(false);
      }
    }

    void fetchJourney({ silent: hasCache });

    return () => {
      journeyFetchControllerRef.current?.abort();
      journeyFetchControllerRef.current = null;
    };
  }, [journeyId, applyJourney, fetchJourney]);

  const handleRetryJourneyLoad = useCallback(() => {
    void fetchJourney({ silent: false });
  }, [fetchJourney]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTestUsers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!journeyId) return false;
      const silent = options?.silent ?? false;
      const url = `/api/journeys/${journeyId}/test-users`;
      if (process.env.NODE_ENV !== 'production' && !silent) {
        console.debug('[JourneyBuilder] Fetching test users', { url, journeyId });
      }
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = (await response.json().catch(() => ({}))) as TestUsersApiResponse;
        if (!response.ok) {
          const errorMessage = data?.error || `Failed to load test users (status ${response.status})`;
          throw new Error(errorMessage);
        }
        if (!isMountedRef.current) {
          return true;
        }
        testUsersRetryRef.current = 0;
        setTestUsers(data.testUsers ?? []);
        return true;
      } catch (error: unknown) {
        const isTypeError = error instanceof TypeError;
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unable to load test users';
        console.error('[JourneyBuilder] Failed to fetch test users', {
          error: error instanceof Error ? error.stack ?? error.message : error,
          journeyId,
          retryCount: testUsersRetryRef.current,
          isTypeError,
          url,
        });
        testUsersRetryRef.current += 1;
        if (!silent || testUsersRetryRef.current >= MAX_TEST_MODE_RETRIES) {
          if (!isMountedRef.current) {
            return false;
          }
          const message = isTypeError
            ? 'Network error while loading test users. Check connectivity and CORS configuration.'
            : errorMessage;
          toast.error(message);
        }
        return false;
      }
    },
    [journeyId, toast],
  );

  const fetchExecutionData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!journeyId) return false;
      const silent = options?.silent ?? false;
      const url = `/api/journeys/${journeyId}/test-executions`;
      if (process.env.NODE_ENV !== 'production' && !silent) {
        console.debug('[JourneyBuilder] Fetching test executions', { url, journeyId });
      }
      if (executionLoadingRef.current) {
        return true;
      }
      executionLoadingRef.current = true;
      if (!silent) {
        setIsExecutionLoading(true);
      }
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = (await response.json().catch(() => ({}))) as TestExecutionsApiResponse;
        if (!response.ok) {
          const errorMessage = data?.error || `Failed to load journey progress (status ${response.status})`;
          throw new Error(errorMessage);
        }
        if (!isMountedRef.current) {
          return true;
        }
        executionRetryRef.current = 0;
        setJourneyProgress(data.progress ?? []);
        setExecutionLogs(data.logs ?? []);
        return true;
      } catch (error: unknown) {
        const isTypeError = error instanceof TypeError;
        const errorMessage =
          error instanceof Error ? error.message : 'Unable to load journey progress';
        console.error('[JourneyBuilder] Failed to fetch execution data', {
          error: error instanceof Error ? error.stack ?? error.message : error,
          journeyId,
          retryCount: executionRetryRef.current,
          isTypeError,
          url,
        });
        executionRetryRef.current += 1;
        if (!silent || executionRetryRef.current >= MAX_TEST_MODE_RETRIES) {
          if (!isMountedRef.current) {
            return false;
          }
          const message = isTypeError
            ? 'Network error while loading journey progress. Check connectivity and CORS configuration.'
            : errorMessage;
          toast.error(message);
        }
        return false;
      } finally {
        executionLoadingRef.current = false;
        if (!silent && isMountedRef.current) {
          setIsExecutionLoading(false);
        }
      }
    },
    [journeyId, toast],
  );

  const fetchTestUsersRef = useRef(fetchTestUsers);
  const fetchExecutionDataRef = useRef(fetchExecutionData);
  useEffect(() => {
    fetchTestUsersRef.current = fetchTestUsers;
  }, [fetchTestUsers]);
  useEffect(() => {
    fetchExecutionDataRef.current = fetchExecutionData;
  }, [fetchExecutionData]);

  useEffect(() => {
    if (!journeyId) return;
    testUsersRetryRef.current = 0;
    executionRetryRef.current = 0;
    void fetchTestUsersRef.current?.();
    void fetchExecutionDataRef.current?.();
  }, [journeyId]);

  useEffect(() => {
    const clearPollTimer = () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };

    if (!journeySettings?.testMode || !journeyId) {
      clearPollTimer();
      lastTestModePollAtRef.current = 0;
      return;
    }

    testUsersRetryRef.current = 0;
    executionRetryRef.current = 0;

    let cancelled = false;

    function scheduleNextPoll(delay = TEST_MODE_POLL_INTERVAL_MS) {
      if (cancelled) return;
      const safeDelay = Math.max(1000, delay);
      clearPollTimer();
      pollTimeoutRef.current = setTimeout(() => {
        void runPoll({ silent: true });
      }, safeDelay);
    }

    async function runPoll(options?: { silent?: boolean }) {
      if (cancelled) return;

      const now = Date.now();
      const elapsed = now - lastTestModePollAtRef.current;
      if (lastTestModePollAtRef.current !== 0 && elapsed < TEST_MODE_POLL_INTERVAL_MS) {
        scheduleNextPoll(TEST_MODE_POLL_INTERVAL_MS - elapsed);
        return;
      }

      lastTestModePollAtRef.current = now;

      const executionOk = await fetchExecutionDataRef.current?.(options);
      const usersOk = await fetchTestUsersRef.current?.(options);

      const executionExceeded = executionOk === false && executionRetryRef.current >= MAX_TEST_MODE_RETRIES;
      const usersExceeded = usersOk === false && testUsersRetryRef.current >= MAX_TEST_MODE_RETRIES;

      if (executionExceeded || usersExceeded) {
        console.warn('[JourneyBuilder] Test mode polling stopped after reaching retry limit.');
        cancelled = true;
        clearPollTimer();
        lastTestModePollAtRef.current = 0;
        return;
      }

      scheduleNextPoll();
    }

    void runPoll();

    return () => {
      cancelled = true;
      clearPollTimer();
      executionLoadingRef.current = false;
      testUsersRetryRef.current = 0;
      executionRetryRef.current = 0;
      lastTestModePollAtRef.current = 0;
    };
  }, [journeySettings?.testMode, journeyId]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const response = await fetch('/api/whatsapp/templates', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to load WhatsApp templates');
        }
        const payload = await response.json();
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        setTemplates(payload.templates ?? []);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        console.error(error);
        toast.error('Unable to load WhatsApp templates');
      } finally {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        setTemplatesLoading(false);
      }
    };

    void loadTemplates();

    return () => {
      isMounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode = useMemo(() => nodes.find(node => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodesRef.current.find(node => node.id === connection.source);
      let label: string | undefined;
      if (sourceNode?.data.variant === 'decision') {
        const meta = sourceNode.data.meta as JourneyNodeData['meta'];
        if (connection.sourceHandle === 'yes' || connection.sourceHandle === 'true') {
          label = (meta?.trueLabel as string) || 'Yes';
        } else if (connection.sourceHandle === 'no' || connection.sourceHandle === 'false') {
          label = (meta?.falseLabel as string) || 'No';
        }
      } else if (sourceNode?.data.variant === 'experiment') {
        const variants = Array.isArray(sourceNode.data.meta?.variants)
          ? (sourceNode.data.meta?.variants as Array<{ id?: string; label?: string }>)
          : [];
        const match = variants.find(variant => variant.id === connection.sourceHandle);
        if (match?.label) {
          label = match.label;
        }
      }
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            id: `edge_${crypto.randomUUID()}`,
            type: 'journey',
            label,
            markerEnd: { type: 'arrowclosed', color: '#9CA3AF', width: 20, height: 20 },
            data: {},
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!isCanvasReady || !reactFlowBounds) return;

      const transfer = event.dataTransfer?.getData('application/reactflow');
      if (!transfer) return;

      const parsed = JSON.parse(transfer) as Partial<JourneyNodeData> & { subtype?: string; meta?: JsonMap };

      let position = { x: 360, y: 240 };
      try {
        position = reactFlow.screenToFlowPosition({
          x: event.clientX ?? 0,
          y: event.clientY ?? 0,
        });
      } catch (error) {
        console.warn('Falling back to default drop position', error);
      }

      const id = `node_${crypto.randomUUID()}`;
      const catalogNode = JOURNEY_NODE_CATALOG.flatMap(category => category.nodes).find(
        node => node.subtype === parsed.subtype
      );

      const variant = (parsed.variant ?? catalogNode?.variant) ?? 'action';

      const initialMeta: JsonMap = parsed.meta && typeof parsed.meta === 'object' ? { ...parsed.meta } : {};

      const newNode: Node<JourneyNodeData> = {
        id,
        type: variant,
        position,
        data: {
          label: parsed.label ?? catalogNode?.name ?? 'Node',
          description: parsed.description ?? catalogNode?.description,
          variant,
          subtype: parsed.subtype,
          icon: catalogNode?.icon,
          meta: initialMeta,
          goalConfig: initialMeta.goalConfig as GoalConfig | undefined,
        },
        style: {
          width: (parsed.meta as { width?: number } | undefined)?.width ?? 280,
        },
      };

      if (variant === 'trigger' && unifiedTriggerEnabled) {
        const defaultConfig = createDefaultUnifiedTriggerConfig();
        newNode.data = {
          ...newNode.data,
          label: defaultConfig.cleverTapStyle?.name ?? newNode.data.label,
          meta: {
            ...newNode.data.meta,
            unified: true,
            triggerType: 'unified',
            triggerConfiguration: defaultConfig,
            conditionSummary: undefined,
            eventSummary: undefined,
            isConfigured: false,
          },
          triggerConfig: defaultConfig,
          status: 'draft',
          userCount: defaultConfig.cleverTapStyle?.estimatedUserCount ?? 0,
          isConfigured: false,
        };
      }

      setNodes(nds => nds.concat(newNode));
      setSelectedNodeId(id);
    },
    [isCanvasReady, reactFlow, setNodes, setSelectedNodeId, unifiedTriggerEnabled]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleReactFlowInit = useCallback(
    (instance?: ReactFlowInstance<Node<JourneyNodeData>>) => {
      setIsCanvasReady(true);
      if (instance) {
        reactFlowInstanceRef.current = instance;
      }
      if (!journeyId || typeof window === 'undefined') return;

      const storage = getWindowStorage();
      const preferences = storage.getJSON<JsonMap>(USER_PREFERENCES_KEY, {}) ?? {};
      const journeyViewports = preferences?.journeyViewports as Record<string, Viewport> | undefined;
      const viewport = journeyViewports?.[journeyId];

      if (viewport) {
        try {
          if (instance) {
            instance.setViewport(viewport, { duration: 0 });
          } else {
            reactFlow.setViewport(viewport);
          }
          viewportRef.current = viewport;
        } catch (error) {
          console.warn('Unable to restore journey viewport', error);
        }
      }
    },
    [journeyId, reactFlow]
  );

  useEffect(() => {
    if (!isCanvasReady || !initialised) return;
    const instance = reactFlowInstanceRef.current;
    if (!instance) return;
    if (nodes.length === 0) return;
    if (nodes.length <= 3) {
      requestAnimationFrame(() => {
        try {
          instance.fitView({ padding: 0.3, duration: 200 });
        } catch (error) {
          console.warn('Unable to auto-fit view', error);
        }
      });
    }
  }, [isCanvasReady, initialised, nodes.length]);

  const handleNodeClick = useCallback((_: ReactMouseEvent | ReactKeyboardEvent, node: Node<JourneyNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      viewportRef.current = viewport;
      if (!journeyId || typeof window === 'undefined') return;
      const storage = getWindowStorage();
      const preferences = storage.getJSON<JsonMap>(USER_PREFERENCES_KEY, {}) ?? {};
      const existingViewports = (preferences?.journeyViewports as Record<string, Viewport>) ?? {};
      const currentViewport = existingViewports[journeyId];
      const isUnchanged =
        currentViewport &&
        currentViewport.x === viewport.x &&
        currentViewport.y === viewport.y &&
        currentViewport.zoom === viewport.zoom;
      if (isUnchanged) return;
      storage.setJSON(USER_PREFERENCES_KEY, {
        ...preferences,
        journeyViewports: {
          ...existingViewports,
          [journeyId]: viewport,
        },
      });
    },
    [journeyId]
  );

  const createSnapshot = useCallback(
    async (reason: string, options: { silent?: boolean } = {}) => {
      if (!journeyId) return;
      const { silent = false } = options;
      if (!silent) {
        setIsSnapshotting(true);
      }
      try {
        const response = await fetch(`/api/journeys/${journeyId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to create snapshot');
        }
        if (!silent) {
          toast.success('Snapshot created');
        }
      } catch (error: unknown) {
        const message = fallbackMessage(error, 'Unable to create snapshot');
        if (!silent) {
          toast.error(message);
        } else {
          console.error('Snapshot error', message);
        }
      } finally {
        if (!silent) {
          setIsSnapshotting(false);
        }
      }
    },
    [journeyId, toast]
  );

  const performDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes(nds => nds.filter(node => node.id !== nodeId));
      setEdges(eds => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId(prev => (prev === nodeId ? null : prev));
      void createSnapshot('Auto snapshot • Node removed', { silent: true });
    },
    [createSnapshot, setEdges, setNodes]
  );

  const handleRequestDeleteNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(item => item.id === nodeId);
    setDeleteConfirm({
      isOpen: true,
      nodeId,
      nodeName: node?.data?.label ?? 'Node',
    });
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    setDeleteConfirm({ isOpen: false, nodeId: null, nodeName: '' });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm.nodeId) return;
    performDeleteNode(deleteConfirm.nodeId);
    setDeleteConfirm({ isOpen: false, nodeId: null, nodeName: '' });
    toast.success('Node deleted');
  }, [deleteConfirm.nodeId, performDeleteNode, toast]);

  const handleUpdateNodeMeta = useCallback(
    (nodeId: string, meta: JourneyNodeData['meta']) => {
      let decisionUpdate: { trueLabel: string; falseLabel: string } | null = null;
      let experimentUpdate: Array<{ id: string; label?: string }> | null = null;

      setNodes(currentNodes =>
        currentNodes.map(node => {
          if (node.id !== nodeId) {
            return node;
          }

          const nextMeta = meta ?? {};
          const nextLabel =
            typeof nextMeta?.label === 'string' && nextMeta.label.trim() ? nextMeta.label : node.data.label;
          const nextDescription =
            typeof nextMeta?.description === 'string' && nextMeta.description.trim()
              ? nextMeta.description
              : node.data.description;
          const nextSubtype =
            node.data.variant === 'trigger'
              ? (nextMeta?.triggerType as string) || node.data.subtype || 'manual_entry'
              : node.data.variant === 'action'
                ? node.data.subtype || 'send_whatsapp'
                : node.data.variant === 'wait'
                  ? node.data.subtype || 'fixed_delay'
                  : node.data.variant === 'decision'
                    ? node.data.subtype || 'if_else'
                    : node.data.variant === 'experiment'
                      ? 'ab_test'
                      : node.data.variant === 'goal'
                        ? node.data.subtype || 'goal_achieved'
                        : node.data.subtype;
          const nextConditionConfig =
            nextMeta && 'conditionConfig' in nextMeta
              ? (nextMeta.conditionConfig as ConditionConfig | undefined)
              : node.data.conditionConfig;
          const nextWhatsappConfig =
            nextMeta && 'whatsappActionConfig' in nextMeta
              ? (nextMeta.whatsappActionConfig as WhatsAppActionConfig | undefined)
              : node.data.whatsappConfig;
          const nextDelayConfig =
            nextMeta && 'delayConfig' in nextMeta
              ? (nextMeta.delayConfig as DelayConfig | undefined)
              : node.data.delayConfig;
          const nextExperimentConfig =
            nextMeta && 'experimentConfig' in nextMeta
              ? (nextMeta.experimentConfig as ExperimentConfig | undefined)
              : node.data.experimentConfig;
          const nextGoalConfig =
            nextMeta && 'goalConfig' in nextMeta
              ? (nextMeta.goalConfig as GoalConfig | undefined)
              : node.data.goalConfig;
          const nextExperimentType =
            node.data.variant === 'experiment'
              ? ((nextMeta?.experimentType as string) ?? node.data.experimentType ?? 'ab_test')
              : node.data.experimentType;
          const nextVariantCount =
            node.data.variant === 'experiment' && Array.isArray(nextMeta?.variants)
              ? (nextMeta.variants as Array<unknown>).length
              : node.data.variantCount;
          const nextIsConfigured =
            typeof nextMeta?.isConfigured === 'boolean' ? nextMeta.isConfigured : node.data.isConfigured;

          const hasMetaChanged = !jsonEquals(node.data.meta, nextMeta);
          const hasChanged =
            hasMetaChanged ||
            nextLabel !== node.data.label ||
            nextDescription !== node.data.description ||
            nextSubtype !== node.data.subtype ||
            nextConditionConfig !== node.data.conditionConfig ||
            nextWhatsappConfig !== node.data.whatsappConfig ||
            nextDelayConfig !== node.data.delayConfig ||
            nextExperimentConfig !== node.data.experimentConfig ||
            nextGoalConfig !== node.data.goalConfig ||
            nextExperimentType !== node.data.experimentType ||
            nextVariantCount !== node.data.variantCount ||
            nextIsConfigured !== node.data.isConfigured;

          if (!hasChanged) {
            return node;
          }

          if (node.data.variant === 'decision') {
            decisionUpdate = {
              trueLabel: (nextMeta?.trueLabel as string) || 'Yes',
              falseLabel: (nextMeta?.falseLabel as string) || 'No',
            };
          } else if (node.data.variant === 'experiment') {
            experimentUpdate = Array.isArray(nextMeta?.variants)
              ? (nextMeta.variants as Array<{ id?: string; label?: string }>)
                  .filter(variant => typeof variant.id === 'string' && variant.id.trim().length > 0)
                  .map(variant => ({ id: variant.id as string, label: variant.label }))
              : [];
          }

          return {
            ...node,
            data: {
              ...node.data,
              label: nextLabel,
              description: nextDescription,
              subtype: nextSubtype,
              conditionConfig: nextConditionConfig,
              whatsappConfig: nextWhatsappConfig,
              delayConfig: nextDelayConfig,
              experimentConfig: nextExperimentConfig,
              goalConfig: nextGoalConfig,
              experimentType: nextExperimentType,
              variantCount: nextVariantCount,
              isConfigured: nextIsConfigured,
              meta: nextMeta,
            },
          };
        })
      );

      if (decisionUpdate) {
        setEdges(currentEdges =>
          currentEdges.map(edge => {
            if (edge.source !== nodeId) return edge;
            if (edge.sourceHandle === 'yes' || edge.sourceHandle === 'true') {
              return edge.label === decisionUpdate!.trueLabel ? edge : { ...edge, label: decisionUpdate!.trueLabel };
            }
            if (edge.sourceHandle === 'no' || edge.sourceHandle === 'false') {
              return edge.label === decisionUpdate!.falseLabel
                ? edge
                : { ...edge, label: decisionUpdate!.falseLabel };
            }
            return edge;
          })
        );
      } else if (experimentUpdate && Array.isArray(experimentUpdate)) {
        const experimentVariants = experimentUpdate as Array<{ id: string; label?: string }>;
        const validIds = new Set(experimentVariants.map(variant => variant.id));
        setEdges(currentEdges =>
          currentEdges
            .filter(edge => edge.source !== nodeId || !edge.sourceHandle || validIds.has(edge.sourceHandle))
            .map(edge => {
              if (edge.source !== nodeId || !edge.sourceHandle) return edge;
              const match = experimentVariants.find(variant => variant.id === edge.sourceHandle);
              return match && match.label && match.label !== edge.label ? { ...edge, label: match.label } : edge;
            })
        );
      }
    },
    [setEdges, setNodes]
  );

  const formatTimeFrameLabel = (timeFrame?: { period?: string; customDays?: number }) => {
    if (!timeFrame?.period) return undefined;
    switch (timeFrame.period) {
      case 'last_24_hours':
        return 'Last 24 hours';
      case 'last_7_days':
        return 'Last 7 days';
      case 'last_30_days':
        return 'Last 30 days';
      case 'last_90_days':
        return 'Last 90 days';
      case 'custom':
        return timeFrame.customDays ? `Last ${timeFrame.customDays} days` : 'Custom window';
      default:
        return undefined;
    }
  };

  const handleUpdateTriggerConfig = useCallback(
    (nodeId: string, config: EnhancedUnifiedTriggerConfig) => {
      setNodes(currentNodes =>
        currentNodes.map(node => {
          if (node.id !== nodeId) return node;

          const cleverTap = config.cleverTapStyle;
          const primaryRule =
            cleverTap?.targetSegment.rules[0] ?? cleverTap?.targetSegment.ruleGroups[0]?.rules[0];
          const eventSummary =
            primaryRule?.eventDisplayName ?? primaryRule?.eventName ?? node.data.meta?.eventSummary;
          const timeframeSummary = formatTimeFrameLabel(primaryRule?.timeFrame);

          const nextMeta: JsonMap = {
            ...(node.data.meta || {}),
            unified: true,
            triggerType: 'unified',
            triggerConfiguration: config,
          };
          if (config.segmentName) {
            nextMeta.segmentName = config.segmentName;
          } else {
            delete nextMeta.segmentName;
          }
          if (eventSummary) {
            nextMeta.eventSummary = eventSummary;
          } else {
            delete nextMeta.eventSummary;
          }
          if (timeframeSummary) {
            nextMeta.timeframeSummary = timeframeSummary;
          } else {
            delete nextMeta.timeframeSummary;
          }

          const filtersCount = primaryRule?.conditions?.length ?? 0;
          if (filtersCount > 0) {
            nextMeta.filtersCount = filtersCount;
          } else {
            delete nextMeta.filtersCount;
          }

          const isConfigured =
            Boolean(cleverTap?.targetSegment.rules.length) ||
            Boolean(cleverTap?.targetSegment.ruleGroups.length);
          nextMeta.isConfigured = isConfigured;

          if (typeof cleverTap?.estimatedUserCount === 'number') {
            nextMeta.estimatedUserCount = cleverTap.estimatedUserCount;
          } else {
            delete nextMeta.estimatedUserCount;
          }

          const nextLabel =
            cleverTap?.name && cleverTap.name.trim().length > 0 ? cleverTap.name : node.data.label;
          const nextUserCount = cleverTap?.estimatedUserCount ?? node.data.userCount;

          const hasMetaChanged = !jsonEquals(node.data.meta, nextMeta);
          const hasConfigChanged = !jsonEquals(node.data.triggerConfig, config);
          const hasLabelChanged = nextLabel !== node.data.label;
          const hasUserCountChanged = nextUserCount !== node.data.userCount;
          const hasConfiguredChanged = isConfigured !== node.data.isConfigured;

          if (
            !hasMetaChanged &&
            !hasConfigChanged &&
            !hasLabelChanged &&
            !hasUserCountChanged &&
            !hasConfiguredChanged
          ) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              meta: nextMeta,
              triggerConfig: config,
              status: node.data.status ?? 'draft',
              isConfigured,
              label: nextLabel,
              userCount: nextUserCount,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const handleTriggerStatusChange = useCallback(
    (nodeId: string, nextStatus: 'draft' | 'active') => {
      setNodes(nds =>
        nds.map(node => {
          if (node.id !== nodeId) return node;
          const meta: JsonMap = { ...(node.data.meta || {}) };
          meta.status = nextStatus;
          return {
            ...node,
            data: {
              ...node.data,
              meta,
              status: nextStatus,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const handleTriggerSave = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find(item => item.id === nodeId);
      if (unifiedTriggerEnabled && node?.data.variant === 'trigger') {
        const config = node.data.triggerConfig ?? convertLegacyTriggerMetaToUnified(node.data.meta || {});
        const rules = config?.targetSegment?.rules;
        const hasValidRules =
          Array.isArray(rules) &&
          rules.length > 0 &&
          rules.every(rule => Boolean(rule.eventName?.trim()));
        if (!hasValidRules) {
          toast.error('Add at least one event rule before saving the trigger.');
          setSelectedNodeId(nodeId);
          return;
        }
      }
      setNodes(nds =>
        nds.map(nodeItem => {
          if (nodeItem.id !== nodeId) return nodeItem;
          const meta: JsonMap = { ...(nodeItem.data.meta || {}) };
          meta.isConfigured = true;
          return {
            ...nodeItem,
            data: {
              ...nodeItem.data,
              meta,
              isConfigured: true,
            },
          };
        })
      );
      toast.success('Trigger configuration saved');
    },
    [setNodes, setSelectedNodeId, toast, unifiedTriggerEnabled]
  );

  const handleInspectorClose = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      setNodes(nds => {
        const source = nds.find(node => node.id === nodeId);
        if (!source) {
          toast.error('Node not found');
          return nds;
        }
        
        // Generate unique ID for cloned node
        const cloneId = `node_${crypto.randomUUID()}`;
        
        // Offset position so duplicate doesn't overlap original
        const position = {
          x: source.position.x + 60,
          y: source.position.y + 60,
        };
        
        // Deep clone meta to avoid reference issues
        const safeCloneMeta = (value?: Record<string, unknown>) => {
          if (!value) return undefined;
          try {
            if (typeof structuredClone === 'function') {
              return structuredClone(value);
            }
          } catch (error) {
            // Fallback to JSON parse/stringify
          }
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (error) {
            // Final fallback to shallow copy
            return { ...value };
          }
        };
        
        // Create cloned node with deep-cloned data
        const clonedNode: Node<JourneyNodeData> = {
          ...source,
          id: cloneId,
          position,
          data: {
            ...source.data,
            label: `${source.data.label} (Copy)`, // Indicate it's a copy
            meta: safeCloneMeta(source.data.meta),
            // Reset status for copied nodes
            status: source.data.status === 'active' ? 'draft' : source.data.status,
            // Clear user count for copied nodes
            userCount: undefined,
            // Preserve callbacks
            callbacks: source.data.callbacks,
          },
        };
        
        // Special handling for different node types
        if (clonedNode.data.variant === 'trigger' && clonedNode.data.triggerConfig) {
          // Deep clone trigger config
          clonedNode.data.triggerConfig = safeCloneMeta(clonedNode.data.triggerConfig as Record<string, unknown>) as any;
        }
        
        const newNodes = nds.concat(clonedNode);
        
        // Select the newly created node
        setSelectedNodeId(cloneId);
        
        // Create snapshot for undo/redo
        void createSnapshot('Auto snapshot • Node duplicated', { silent: true });
        
        toast.success('Node duplicated successfully');
        return newNodes;
      });
    },
    [setNodes, setSelectedNodeId, createSnapshot, toast]
  );

  const handleOpenWhatsAppConfig = useCallback(
    (nodeId: string, step?: StepId) => {
      setSelectedNodeId(nodeId);
      setActiveModal({ type: "whatsapp", nodeId, step });
    },
    [],
  );

  const handleEditNode = useCallback(
    (nodeId: string) => {
      // Set selected node first to ensure inspector panel shows correct node
      setSelectedNodeId(nodeId);
      
      // Find node in current ref (most up-to-date)
      const node = nodesRef.current.find(item => item.id === nodeId);
      if (!node) {
        toast.error('Node not found');
        return;
      }
      
      // Open appropriate configuration modal based on node type
      if (node.data.variant === 'trigger') {
        if (unifiedTriggerEnabled) {
          // For unified triggers, just open the inspector panel
          // The inspector will handle trigger configuration
          return;
        }
        setActiveModal({ type: 'trigger', nodeId });
      } else if (node.data.variant === 'action' && node.data.subtype === 'send_whatsapp') {
        setActiveModal({ type: 'whatsapp', nodeId });
      } else if (node.data.variant === 'wait') {
        setActiveModal({ type: 'delay', nodeId });
      } else if (node.data.variant === 'decision') {
        setActiveModal({ type: 'condition', nodeId });
      } else if (node.data.variant === 'experiment') {
        setActiveModal({ type: 'experiment', nodeId });
      } else if (node.data.variant === 'goal') {
        setActiveModal({ type: 'goal', nodeId });
      } else {
        // For other node types, just ensure inspector is open
        // The inspector panel will show configuration options
        console.log('Edit requested for node type:', node.data.variant);
      }
    },
    [setSelectedNodeId, unifiedTriggerEnabled, toast]
  );

  const handleAddNodeFromToolbar = useCallback(
    ({ nodeType, subtype, label, description, meta, toastMessage }: ToolbarAddConfig) => {
      if (!isCanvasReady) {
        toast.error('Canvas is still initialising. Try again in a moment.');
        return;
      }

      const wrapper = reactFlowWrapper.current;
      const bounds = wrapper?.getBoundingClientRect();

      const centerPoint = bounds
        ? {
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          }
        : {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          };

      let position = { x: 360, y: 240 };
      try {
        position = reactFlow.screenToFlowPosition(centerPoint);
      } catch (error) {
        console.warn('Falling back to default node position', error);
      }

      const catalogNode = JOURNEY_NODE_CATALOG.flatMap(category => category.nodes).find(
        item => item.subtype === subtype
      );

      const nodeTypeToVariant: Record<ToolbarNodeKind, JourneyNodeData['variant']> = {
        trigger: 'trigger',
        action: 'action',
        delay: 'wait',
        condition: 'decision',
        experiment: 'experiment',
        goal: 'goal',
      };

      const safeCloneMeta = (value?: JsonMap) => {
        if (!value) return undefined;
        try {
          if (typeof structuredClone === 'function') {
            return structuredClone(value);
          }
        } catch (error) {
          /* ignore structured clone failure */
        }
        try {
          return JSON.parse(JSON.stringify(value));
        } catch (error) {
          return { ...value };
        }
      };

      const clonedMeta = safeCloneMeta(meta);
      if (clonedMeta) {
        const variants = (clonedMeta as { variants?: unknown }).variants;
        if (Array.isArray(variants)) {
          const normalisedVariants = variants.map((variantItem, index) => {
            if (typeof variantItem === 'object' && variantItem !== null) {
              const record = variantItem as VariantMeta;
              const variantId =
                typeof record.id === 'string' && record.id.trim().length > 0
                  ? record.id
                  : generateId(`variant${index}`);
              return { ...record, id: variantId } satisfies VariantMeta;
            }
            return { id: generateId(`variant${index}`) } satisfies VariantMeta;
          });
          (clonedMeta as { variants: VariantMeta[] }).variants = normalisedVariants;
        }
      }

      const variant = nodeTypeToVariant[nodeType] ?? 'action';
      const nodeId = generateId('node');
      const nodeLabel = label ?? catalogNode?.name ?? 'Node';
      const nodeDescription = description ?? catalogNode?.description;

      const newNode: Node<JourneyNodeData> = {
        id: nodeId,
        type: variant,
        position,
        data: {
          label: nodeLabel,
          description: nodeDescription,
          variant,
          subtype,
          icon: catalogNode?.icon,
          meta: clonedMeta,
        },
        style: {
          width: 280,
        },
      };

      setNodes(nds => nds.concat(newNode));
      setSelectedNodeId(nodeId);
      toast.success(toastMessage ?? `${nodeLabel} added to canvas`);
      void createSnapshot(`Auto snapshot • Added ${nodeLabel}`, { silent: true });
    },
    [createSnapshot, isCanvasReady, reactFlow, setNodes, toast]
  );

  const handleAddTriggerNode = useCallback(() => {
    handleAddNodeFromToolbar({
      nodeType: 'trigger',
      subtype: 'segment_joined',
      label: 'Segment Trigger',
      toastMessage: 'Trigger node added to canvas',
    });
  }, [handleAddNodeFromToolbar]);

  const handleToggleTestMode = useCallback(() => {
    if (!journey) {
      toast.error('Load a journey before toggling Test Mode.');
      return;
    }
    setJourneySettings(prev => {
      if (!prev) return prev;
      const nextMode = !prev.testMode;
      if (prev.testMode && !nextMode) {
        const message =
          testUsers.length > 0
            ? 'Disable Test Mode? Test users will be preserved, but future runs will include production customers.'
            : 'Disable Test Mode and resume production sends?';
        if (typeof window !== 'undefined' && !window.confirm(message)) {
          return prev;
        }
      }
      if (!prev.testMode && nextMode) {
        toast.info('Test Mode enabled. Only contacts in your test list will be enrolled.');
      } else if (prev.testMode && !nextMode) {
        toast.success('Test Mode disabled. Journey will now target production customers.');
      }
      return {
        ...prev,
        testMode: nextMode,
      };
    });
  }, [journey, setJourneySettings, testUsers.length, toast]);

  const handleAddDelayNode = useCallback(() => {
    const defaultDelayConfig: DelayConfig = {
      delayType: 'fixed_time',
      specificConfig: {
        type: 'fixed_time',
        duration: { value: 1, unit: 'days' },
        description: '',
      },
      quietHours: {
        enabled: false,
        startTime: { hour: 21, minute: 0 },
        endTime: { hour: 9, minute: 0 },
        timezone: 'customer',
      },
      holidaySettings: {
        skipWeekends: false,
        skipHolidays: false,
        holidayCalendar: 'us',
        customHolidayDates: [],
      },
      throttling: {
        enabled: false,
      },
      nodeName: 'Wait / Delay',
      description: '',
    };

    handleAddNodeFromToolbar({
      nodeType: 'delay',
      subtype: 'fixed_delay',
      label: 'Wait / Delay',
      meta: {
        label: 'Wait / Delay',
        delayType: defaultDelayConfig.delayType,
        delaySummary: summariseDelayConfig(defaultDelayConfig),
        delayConfig: defaultDelayConfig,
        quietHoursEnabled: false,
        skipWeekends: false,
        throttled: false,
        hasTimeoutBranch: false,
        timeoutBranchLabel: undefined,
      },
      toastMessage: 'Delay node added to canvas',
    });
  }, [handleAddNodeFromToolbar]);

  const handleAddConditionNode = useCallback(() => {
    handleAddNodeFromToolbar({
      nodeType: 'condition',
      subtype: 'if_else',
      label: 'Conditional Branch',
      meta: {
        conditionType: 'attribute',
        conditions: [],
        trueLabel: 'Yes',
        falseLabel: 'No',
        label: 'Conditional Branch',
      },
      toastMessage: 'Condition node added to canvas',
    });
  }, [handleAddNodeFromToolbar]);

  const handleAddExperimentNode = useCallback(() => {
    handleAddNodeFromToolbar({
      nodeType: 'experiment',
      subtype: 'ab_test',
      label: 'A/B Test',
      meta: {
        experimentName: 'A/B Test',
        experimentType: 'ab_test',
        variants: [
          { id: generateId('variant'), label: 'Control', weight: 50, control: true, color: '#6366F1' },
          { id: generateId('variant'), label: 'Variant B', weight: 50, color: '#F59E0B' },
        ],
        experimentSummary: 'Configure experiment to start testing.',
        primaryGoalName: null,
        isConfigured: false,
      },
      toastMessage: 'Experiment node added to canvas',
    });
  }, [handleAddNodeFromToolbar]);

  const handleAddGoalNode = useCallback(() => {
    const defaultGoalConfig: GoalConfig = {
      goalType: 'journey_completion',
      goalName: 'Journey Completed',
      goalDescription: 'Mark users as completed once they reach the end of this journey.',
      goalCategory: 'conversion',
      attributionWindow: { value: 7, unit: 'days' },
      attributionModel: 'last_touch',
      countMultipleConversions: false,
      exitAfterGoal: true,
      markAsCompleted: true,
    };

    handleAddNodeFromToolbar({
      nodeType: 'goal',
      subtype: 'goal_achieved',
      label: 'Journey Goal',
      meta: {
        label: 'Journey Goal',
        goalConfig: defaultGoalConfig,
        goalType: defaultGoalConfig.goalType,
        goalName: defaultGoalConfig.goalName,
        goalCategory: defaultGoalConfig.goalCategory,
        goalDescription: defaultGoalConfig.goalDescription,
        goalSummary: summariseGoalConfig(defaultGoalConfig),
        attributionWindow: defaultGoalConfig.attributionWindow,
        attributionModel: defaultGoalConfig.attributionModel,
        exitAfterGoal: defaultGoalConfig.exitAfterGoal,
        markAsCompleted: defaultGoalConfig.markAsCompleted,
        isConfigured: false,
      },
      toastMessage: 'Goal node added to canvas',
    });
  }, [handleAddNodeFromToolbar]);

  const handleAddTestUser = useCallback(
    async (user: Omit<TestUser, 'id' | 'addedAt'>) => {
      if (!journeyId) return false;
      try {
        const response = await fetch(`/api/journeys/${journeyId}/test-users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });
        const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to add test user');
        }
        toast.success('Test user added');
        await fetchTestUsers();
        await fetchExecutionData();
        return true;
      } catch (error) {
        const message = fallbackMessage(error, 'Unable to add test user');
        console.error(message);
        toast.error(message);
        return false;
      }
    },
    [journeyId, fetchTestUsers, fetchExecutionData, toast]
  );

  const handleRemoveTestUser = useCallback(
    async (id: string) => {
      if (!journeyId) return;
      try {
        const response = await fetch(`/api/journeys/${journeyId}/test-users/${id}`, { method: 'DELETE' });
        const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to remove test user');
        }
        toast.success('Test user removed');
        await fetchTestUsers();
        await fetchExecutionData();
      } catch (error) {
        const message = fallbackMessage(error, 'Unable to remove test user');
        console.error(message);
        toast.error(message);
      }
    },
    [journeyId, fetchTestUsers, fetchExecutionData, toast]
  );

  const handleClearTestUsers = useCallback(async () => {
    if (!journeyId || !testUsers.length) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Remove all test users? This cannot be undone.');
      if (!confirmed) return;
    }
    try {
      const response = await fetch(`/api/journeys/${journeyId}/test-users`, { method: 'DELETE' });
      const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to clear test users');
      }
      toast.success('Cleared test users');
      await fetchTestUsers();
      await fetchExecutionData();
    } catch (error) {
      const message = fallbackMessage(error, 'Unable to clear test users');
      console.error(message);
      toast.error(message);
    }
  }, [journeyId, testUsers.length, fetchTestUsers, fetchExecutionData, toast]);

  const handleTriggerTestUser = useCallback(
    async (testUserId: string) => {
      if (!journeyId) return false;
      try {
        const response = await fetch(`/api/journeys/${journeyId}/test-trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testUserId }),
        });
        const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to trigger journey');
        }
        toast.success('Journey triggered for test user');
        await fetchExecutionData();
        return true;
      } catch (error) {
        const message = fallbackMessage(error, 'Unable to trigger journey');
        console.error(message);
        toast.error(message);
        return false;
      }
    },
    [journeyId, fetchExecutionData, toast]
  );

  const handleRefreshExecutions = useCallback(async () => {
    await fetchExecutionData();
  }, [fetchExecutionData]);

  const handleClearExecutionData = useCallback(async () => {
    if (!journeyId) return;
    try {
      const response = await fetch(`/api/journeys/${journeyId}/test-executions/clear`, { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to clear test data');
      }
      toast.success('Cleared test execution data');
      await fetchExecutionData();
    } catch (error) {
      const message = fallbackMessage(error, 'Unable to clear test data');
      console.error(message);
      toast.error(message);
    }
  }, [journeyId, fetchExecutionData, toast]);

  const handleViewExecutionLog = useCallback((testUserId: string) => {
    setExecutionLogModal({ open: true, testUserId });
  }, []);

  const closeExecutionLogModal = useCallback(() => {
    setExecutionLogModal({ open: false });
  }, []);

  const focusNodeOnCanvas = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const instance = reactFlowInstanceRef.current;
      if (!instance) return;
      try {
        instance.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.4 });
      } catch (error) {
        console.warn('Unable to focus node', error);
      }
    },
    []
  );

  const handleGoToNodeFromValidation = useCallback(
    (nodeId: string) => {
      focusNodeOnCanvas(nodeId);
      setValidationModalOpen(false);
      setPendingStatusChange(null);
    },
    [focusNodeOnCanvas]
  );

  const handleGoToNodeFromExecution = useCallback(
    (nodeId: string) => {
      focusNodeOnCanvas(nodeId);
      closeExecutionLogModal();
    },
    [focusNodeOnCanvas, closeExecutionLogModal]
  );

  const executionLogEntriesForModal = useMemo(() => {
    if (!executionLogModal.open) return [];
    if (!executionLogModal.testUserId) return executionLogs;
    return executionLogs.filter(log => log.testUserId === executionLogModal.testUserId);
  }, [executionLogModal, executionLogs]);

  const executionLogUserLabel = useMemo(() => {
    if (!executionLogModal.open || !executionLogModal.testUserId) return undefined;
    const user = testUsers.find(item => item.id === executionLogModal.testUserId);
    return user ? user.name || user.email || user.phone : undefined;
  }, [executionLogModal, testUsers]);

  const handleAddActionNode = useCallback(
    (actionType: 'whatsapp' | 'add_tag' | 'update_property' | 'generate_discount' | 'http_webhook') => {
      if (actionType === 'whatsapp') {
        handleAddNodeFromToolbar({
          nodeType: 'action',
          subtype: 'send_whatsapp',
          label: 'WhatsApp Message',
          meta: {
            actionType: 'whatsapp',
            channel: 'whatsapp',
            templateId: null,
            templateName: null,
            variableMappings: {},
            timing: 'immediate',
            label: 'WhatsApp Message',
          },
          toastMessage: 'WhatsApp action added to canvas',
        });
        return;
      }

      if (actionType === 'add_tag') {
        handleAddNodeFromToolbar({
          nodeType: 'action',
          subtype: 'add_tag',
          label: 'Add Customer Tag',
          meta: {
            actionType: 'add_tag',
            tags: [],
            label: 'Add Customer Tag',
          },
          toastMessage: 'Tagging action added to canvas',
        });
        return;
      }

      if (actionType === 'generate_discount') {
        handleAddNodeFromToolbar({
          nodeType: 'action',
          subtype: 'generate_discount',
          label: 'Generate Discount Code',
          meta: {
            actionType: 'generate_discount',
            discountType: 'percentage',
            value: 10,
            prefix: 'SAVE',
            usageLimit: 1,
            expiresInDays: 30,
            label: 'Generate Discount Code',
          },
          toastMessage: 'Discount code action added to canvas',
        });
        return;
      }

      if (actionType === 'http_webhook') {
        handleAddNodeFromToolbar({
          nodeType: 'action',
          subtype: 'http_webhook',
          label: 'HTTP Webhook',
          meta: {
            actionType: 'http_webhook',
            method: 'POST',
            url: '',
            headers: {},
            label: 'HTTP Webhook',
          },
          toastMessage: 'Webhook action added to canvas',
        });
        return;
      }

      handleAddNodeFromToolbar({
        nodeType: 'action',
        subtype: 'update_property',
        label: 'Update Profile Property',
        meta: {
          actionType: 'update_property',
          updates: [],
          label: 'Update Profile Property',
        },
        toastMessage: 'Profile update action added to canvas',
      });
    },
    [handleAddNodeFromToolbar]
  );

  type ApiErrorResponse = {
    error?: string;
  };

  type ValidationResponse = {
    errors?: ValidationError[];
    warnings?: ValidationError[];
    evaluatedAt?: string;
    error?: string;
  };

  const runValidation = useCallback(async () => {
    if (!journeyId) return null;
    setIsValidating(true);
    try {
      const response = await fetch(`/api/journeys/${journeyId}/validate`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({ errors: [], warnings: [] }))) as ValidationResponse;
      if (!response.ok) {
        console.error('[journeys][validation] API error', data);
        throw new Error(data?.error || 'Failed to run validation');
      }
      const errors = data?.errors ?? [];
      const warnings = data?.warnings ?? [];
      setValidationErrors(errors);
      setValidationWarnings(warnings);
      setLastValidationAt(data?.evaluatedAt ? new Date(data.evaluatedAt) : new Date());
      return data;
    } catch (error) {
      const message = fallbackMessage(error, 'Unable to validate journey');
      console.error('[journeys][validation] Failed to validate journey', message);
      toast.error(message);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [journeyId, toast]);

  const handleManualValidate = useCallback(() => {
    setPendingStatusChange(null);
    setValidationModalOpen(true);
    void runValidation();
  }, [runValidation]);

  const handleRetryValidation = useCallback(() => {
    void runValidation();
  }, [runValidation]);

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges(eds => eds.filter(edge => edge.id !== edgeId));
    },
    [setEdges]
  );

  const decoratedEdges = edges;

  // Attach callbacks to nodes for action buttons (Edit, Delete, Duplicate)
  const renderedNodes = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        callbacks: {
          onEdit: handleEditNode,
          onDelete: handleRequestDeleteNode,
          onDuplicate: handleDuplicateNode,
        },
      },
    }));
  }, [nodes, handleEditNode, handleRequestDeleteNode, handleDuplicateNode]);

  const toolbarValidationSummary = useMemo(() => {
    if (!lastValidationAt) return null;
    const errorCount = validationErrors.length;
    const warningCount = validationWarnings.length;
    const status: 'pass' | 'needs_attention' | 'fail' = errorCount > 0 ? 'fail' : warningCount > 0 ? 'needs_attention' : 'pass';
    return {
      status,
      errors: errorCount,
      warnings: warningCount,
      evaluatedAt: lastValidationAt,
    };
  }, [validationErrors, validationWarnings, lastValidationAt]);

  const buildSavePayload = useCallback(
    (nodeList: Node<JourneyNodeData>[], edgeList: Edge[]): JourneySavePayload => ({
      name: journeyName,
      status: journeyStatus === 'active' ? 'ACTIVE' : journeyStatus === 'paused' ? 'PAUSED' : 'DRAFT',
      settings: journeySettings,
      nodes: nodeList.map(mapFlowNodeToDomain),
      edges: edgeList.map(mapFlowEdgeToDomain),
    }),
    [journeyName, journeySettings, journeyStatus]
  );

  const autoSaveJourney = useCallback(
    async (payload: JourneySavePayload) => {
      if (!journeyId) return;
      try {
        await fetch(`/api/journeys/${journeyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const updatedAt = new Date();
        setLastSavedAt(updatedAt);
        const previous = journeyRef.current;
        const nextJourney: JourneyDefinition = {
          ...(previous ?? {
            id: journeyId,
            createdAt: updatedAt.toISOString(),
            stats: undefined,
          }),
          id: journeyId,
          name: payload.name,
          status: payload.status,
          settings: payload.settings,
          nodes: payload.nodes,
          edges: payload.edges,
          updatedAt: updatedAt.toISOString(),
          stats: previous?.stats,
        };
        setJourney(nextJourney);
        journeyRef.current = nextJourney;

        if (typeof window !== 'undefined') {
          const storage = getWindowStorage();
          storage.setJSON(buildJourneyStorageKey(journeyId), nextJourney);
          const draftSnapshot: JourneyDraftSnapshot = {
            id: journeyId,
            name: payload.name,
            status: journeyStatusRef.current,
            settings: journeySettingsRef.current,
            nodes: nodesRef.current,
            edges: edgesRef.current,
            updatedAt: updatedAt.getTime(),
          };
          storage.setJSON(buildJourneyDraftKey(journeyId), draftSnapshot);
          if (nextJourney.stats) {
            storage.setJSON(buildJourneyStatsKey(journeyId), nextJourney.stats);
          }
        }
      } catch (error) {
        console.error('Auto-save failed', error);
        lastSnapshotRef.current = '';
      }
    },
    [journeyId]
  );

  const debouncedAutoSave = useMemo(
    () =>
      debounce((...args: unknown[]) => {
        void autoSaveJourney(args[0] as JourneySavePayload);
      }, 1000),
    [autoSaveJourney]
  );

  const handleSave = useCallback(async () => {
    if (!journeyId) return;
    if (unifiedTriggerEnabled) {
      const invalidTrigger = nodes.find(node => {
        if (node.data.variant !== 'trigger') return false;
        const config = node.data.triggerConfig ?? convertLegacyTriggerMetaToUnified(node.data.meta || {});
        const rules = config?.targetSegment?.rules;
        if (!Array.isArray(rules) || rules.length === 0) return true;
        return rules.some(rule => !rule.eventName || !rule.eventName.trim());
      });
      if (invalidTrigger) {
        toast.error('Configure the trigger with at least one event before saving.');
        setSelectedNodeId(invalidTrigger.id);
        return;
      }
    }
    setIsSaving(true);
    try {
      const payload = buildSavePayload(nodes, edges);
      const response = await fetch(`/api/journeys/${journeyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      lastSnapshotRef.current = JSON.stringify(payload);
      const updatedAt = new Date();
      setLastSavedAt(updatedAt);
      const previous = journeyRef.current;
      const nextJourney: JourneyDefinition = {
        ...(previous ?? { id: journeyId, createdAt: updatedAt.toISOString(), stats: undefined }),
        id: journeyId,
        name: payload.name,
        status: payload.status,
        settings: payload.settings,
        nodes: payload.nodes,
        edges: payload.edges,
        updatedAt: updatedAt.toISOString(),
        stats: previous?.stats,
      };
      setJourney(nextJourney);
      journeyRef.current = nextJourney;

      if (typeof window !== 'undefined') {
        const storage = getWindowStorage();
        storage.setJSON(buildJourneyStorageKey(journeyId), nextJourney);
        const draftSnapshot: JourneyDraftSnapshot = {
          id: journeyId,
          name: payload.name,
          status: journeyStatusRef.current,
          settings: journeySettingsRef.current,
          nodes: nodesRef.current,
          edges: edgesRef.current,
          updatedAt: updatedAt.getTime(),
        };
        storage.setJSON(buildJourneyDraftKey(journeyId), draftSnapshot);
        if (nextJourney.stats) {
          storage.setJSON(buildJourneyStatsKey(journeyId), nextJourney.stats);
        }
      }
      toast.success('Journey saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save journey');
    } finally {
      setIsSaving(false);
    }
  }, [buildSavePayload, convertLegacyTriggerMetaToUnified, edges, journeyId, nodes, setSelectedNodeId, toast, unifiedTriggerEnabled]);

  const handleToggleStatus = useCallback(async () => {
    if (!journeyId) return;
    if (journeyStatus === 'active') {
      setIsStatusUpdating(true);
      try {
        const response = await fetch(`/api/journeys/${journeyId}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PAUSED' }),
        });
        const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to pause journey');
        }
        setJourneyStatus('paused');
        toast.success('Journey paused');
      } catch (error) {
        const message = fallbackMessage(error, 'Unable to pause journey');
        console.error(message);
        toast.error(message);
      } finally {
        setIsStatusUpdating(false);
      }
      return;
    }

    setPendingStatusChange('activate');
    setValidationModalOpen(true);
    const validation = await runValidation();
    if (!validation) {
      setPendingStatusChange(null);
      setValidationModalOpen(false);
    }
  }, [journeyId, journeyStatus, runValidation, toast]);

  const handleProceedActivation = useCallback(async () => {
    if (!journeyId) return;
    await createSnapshot('Snapshot before activation', { silent: true });
    setIsStatusUpdating(true);
    try {
      const response = await fetch(`/api/journeys/${journeyId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        validation?: ValidationResponse;
        error?: string;
      };
      if (!response.ok) {
        if (data.validation) {
          const validation = data.validation;
          setValidationErrors(validation.errors ?? []);
          setValidationWarnings(validation.warnings ?? []);
          setLastValidationAt(validation.evaluatedAt ? new Date(validation.evaluatedAt) : new Date());
        }
        throw new Error(data?.error || 'Failed to activate journey');
      }
      if (data.validation) {
        const validation = data.validation;
        setValidationErrors(validation.errors ?? []);
        setValidationWarnings(validation.warnings ?? []);
        setLastValidationAt(validation.evaluatedAt ? new Date(validation.evaluatedAt) : new Date());
      } else {
        setValidationErrors([]);
        setValidationWarnings([]);
        setLastValidationAt(new Date());
      }
      setJourneyStatus('active');
      setValidationModalOpen(false);
      setPendingStatusChange(null);
      toast.success('Journey activated');
    } catch (error) {
      const message = fallbackMessage(error, 'Unable to activate journey');
      console.error(message);
      toast.error(message);
      setValidationModalOpen(true);
    } finally {
      setIsStatusUpdating(false);
    }
  }, [journeyId, toast]);

  useEffect(() => () => debouncedAutoSave.cancel(), [debouncedAutoSave]);

  useEffect(() => {
    if (!initialised || !journeyId) {
      return undefined;
    }
    if (nodes.length === 0 && edges.length === 0) {
      return undefined;
    }
    const payload = buildSavePayload(nodes, edges);
    const serialised = JSON.stringify(payload);
    if (serialised === lastSnapshotRef.current) {
      return undefined;
    }
    lastSnapshotRef.current = serialised;
    debouncedAutoSave(payload);

    return () => {
      debouncedAutoSave.cancel();
    };
  }, [nodes, edges, buildSavePayload, debouncedAutoSave, initialised, journeyId]);

  const handleValidationModalClose = useCallback(() => {
    if (isStatusUpdating) return;
    setValidationModalOpen(false);
    setPendingStatusChange(null);
  }, [isStatusUpdating]);

  const activeModalNode = activeModal ? nodes.find(node => node.id === activeModal.nodeId) ?? null : null;

  if (loading && !initialised) {
    return (
      <div className="flex h-full flex-col gap-6 bg-[#FAF9F6] p-6 lg:flex-row">
        <div className="hidden w-[280px] flex-col gap-4 lg:flex">
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-full rounded-3xl" />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <div className="flex flex-1 gap-4">
            <Skeleton className="hidden h-full w-[320px] rounded-3xl lg:block" />
            <div className="flex w-full flex-1 flex-col gap-4">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-full rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (journeyError && !loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#FAF9F6] px-6 text-center text-[#4A4139]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">Unable to load journey</h2>
          <p className="max-w-md text-sm text-[#8B7F76]">
            {journeyError}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
          <Button onClick={handleRetryJourneyLoad}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#FAF9F6] text-[#4A4139]">
      <JourneyToolbar
        name={journeyName}
        status={journeyStatus}
        testMode={Boolean(journeySettings?.testMode)}
        viewMode={viewMode}
        lastSavedAt={lastSavedAt}
        validationSummary={toolbarValidationSummary}
        onAddTrigger={handleAddTriggerNode}
        onAddDelay={handleAddDelayNode}
        onAddCondition={handleAddConditionNode}
        onAddExperiment={handleAddExperimentNode}
        onAddAction={handleAddActionNode}
        onAddGoal={handleAddGoalNode}
        onBack={() => router.back()}
        onNameChange={setJourneyName}
        onSave={handleSave}
        onToggleStatus={() => {
          void handleToggleStatus();
        }}
        onToggleTestMode={handleToggleTestMode}
        onOpenSettings={() => setSettingsOpen(true)}
        isSaving={isSaving}
        onValidate={handleManualValidate}
        isValidating={isValidating}
        isStatusUpdating={isStatusUpdating}
        onCreateSnapshot={() => void createSnapshot('Manual snapshot')}
        isSnapshotting={isSnapshotting}
        onChangeView={setViewMode}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {viewMode === 'analytics' ? (
          <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-auto">
              <AnalyticsDashboard journeyId={journeyId} />
            </div>
          </div>
        ) : isMobile ? (
          /* Mobile Layout */
          <>
            {/* Mobile Left Sidebar Backdrop */}
            {leftSidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={() => setLeftSidebarOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Mobile Left Sidebar */}
            <aside
              className={cn(
                'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-[#E8E4DE] transform transition-transform duration-300 ease-in-out flex flex-col lg:hidden',
                leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E4DE]">
                <h2 className="font-semibold text-[#4A4139]">Journey Blocks</h2>
                <button
                  onClick={() => setLeftSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#F5F3EE] text-[#8B7F76]"
                  aria-label="Close sidebar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <JourneySidebar className="h-full" />
              </div>
            </aside>

            {/* Mobile Canvas Area */}
            <main className="flex-1 overflow-hidden bg-white relative">
              {/* Mobile Canvas Header with Menu Button */}
              <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-[#E8E4DE] bg-white sticky top-0 z-20">
                <button
                  onClick={() => setLeftSidebarOpen(true)}
                  className="p-2 rounded-lg hover:bg-[#F5F3EE] text-[#4A4139] min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                {selectedNodeId && (
                  <button
                    onClick={() => setRightPanelOpen(true)}
                    className="ml-auto p-2 rounded-lg hover:bg-[#F5F3EE] text-[#4A4139] min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Open configuration"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {journeySettings?.testMode ? (
                <>
                  <TestModeBanner
                    onManageTestUsers={() => setTestUsersPanelOpen(true)}
                    onExitTestMode={handleToggleTestMode}
                  />
                  <div className="border-b border-[#E2E8F0] bg-[#EEF2FF] py-4">
                    <TestExecutionPanel
                      testUsers={testUsers}
                      onTriggerJourney={handleTriggerTestUser}
                      onRefreshProgress={handleRefreshExecutions}
                      onClearTestData={handleClearExecutionData}
                      progress={journeyProgress}
                      executionLogs={executionLogs}
                      onViewExecutionLog={handleViewExecutionLog}
                    />
                  </div>
                </>
              ) : null}

              <div className="relative flex-1" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
                <ReactFlow
                  nodes={renderedNodes}
                  edges={decoratedEdges}
                  nodeTypes={journeyNodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onNodeClick={handleNodeClick}
                  onPaneClick={handlePaneClick}
                  onMoveEnd={handleMoveEnd}
                  fitView
                  fitViewOptions={DEFAULT_FIT_VIEW_OPTIONS}
                  proOptions={{ hideAttribution: true }}
                  onInit={handleReactFlowInit}
                  className="journey-flow h-full w-full"
                  style={{ width: '100%', height: '100%' }}
                  defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                >
                  <Background variant={"dots" as any} gap={20} size={1} color="#E2E8F0" />
                  <MiniMap
                    position="bottom-left"
                    pannable
                    zoomable
                    className="rounded-xl border border-[#E2E8F0] bg-white/85 text-[#4A4139] shadow-sm backdrop-blur"
                  />
                  <Controls
                    position="bottom-right"
                    className="rounded-xl border border-[#E2E8F0] bg-white/85 text-[#4A4139] shadow-sm backdrop-blur"
                  />
                </ReactFlow>
              </div>
            </main>

            {/* Mobile Right Panel Backdrop */}
            {rightPanelOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={() => setRightPanelOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Mobile Right Panel */}
            <aside
              className={cn(
                'fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#FAF9F6] border-l border-[#E8E4DE] transform transition-transform duration-300 ease-in-out flex flex-col lg:hidden',
                rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <JourneyNodeInspector
                key={selectedNode?.id ?? 'no-selection'}
                node={selectedNode}
                onClose={() => {
                  setRightPanelOpen(false);
                  handleInspectorClose();
                }}
                onDelete={handleRequestDeleteNode}
                onUpdate={handleUpdateNodeMeta}
                onOpenWhatsAppConfig={handleOpenWhatsAppConfig}
                onUpdateTriggerConfig={handleUpdateTriggerConfig}
                onTriggerStatusChange={handleTriggerStatusChange}
                onTriggerSave={handleTriggerSave}
                className="h-full"
              />
            </aside>
          </>
        ) : (
          /* Desktop Layout with PanelGroup */
          <PanelGroup
            direction="horizontal"
            autoSaveId="journey-builder-panels"
            className="flex h-full w-full"
          >
            <Panel
              ref={sidebarPanelRef}
              defaultSize={20}
              minSize={15}
              maxSize={32}
              collapsible
              collapsedSize={6}
              className="flex h-full flex-col overflow-hidden"
            >
              <JourneySidebar className="h-full" />
            </Panel>

            <ResizeHandle />

            <Panel
              defaultSize={selectedNodeId ? 52 : 68}
              minSize={28}
              className="flex h-full min-w-0 flex-col bg-white transition-[flex-grow,flex-basis,width] duration-200 ease-in-out"
            >
              {journeySettings?.testMode ? (
                <>
                  <TestModeBanner
                    onManageTestUsers={() => setTestUsersPanelOpen(true)}
                    onExitTestMode={handleToggleTestMode}
                  />
                  <div className="border-b border-[#E2E8F0] bg-[#EEF2FF] py-4">
                    <TestExecutionPanel
                      testUsers={testUsers}
                      onTriggerJourney={handleTriggerTestUser}
                      onRefreshProgress={handleRefreshExecutions}
                      onClearTestData={handleClearExecutionData}
                      progress={journeyProgress}
                      executionLogs={executionLogs}
                      onViewExecutionLog={handleViewExecutionLog}
                    />
                  </div>
                </>
              ) : null}

              <div className="relative flex-1" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
                  <button
                    type="button"
                    onClick={toggleSidebarPanel}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#4A4139] shadow-sm transition hover:border-[#C3D0F9] hover:text-[#4971FF] min-h-[44px] min-w-[44px]"
                    title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleInspectorPanel}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#4A4139] shadow-sm transition hover:border-[#C3D0F9] hover:text-[#4971FF] min-h-[44px] min-w-[44px]"
                    title={isInspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
                  >
                    {isInspectorCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                <ReactFlow
                  nodes={renderedNodes}
                  edges={decoratedEdges}
                  nodeTypes={journeyNodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onNodeClick={handleNodeClick}
                  onPaneClick={handlePaneClick}
                  onMoveEnd={handleMoveEnd}
                  fitView
                  fitViewOptions={DEFAULT_FIT_VIEW_OPTIONS}
                  proOptions={{ hideAttribution: true }}
                  onInit={handleReactFlowInit}
                  className="journey-flow h-full w-full"
                  style={{ width: '100%', height: '100%' }}
                  defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                >
                  <Background variant={"dots" as any} gap={20} size={1} color="#E2E8F0" />
                  <MiniMap
                    position="bottom-left"
                    pannable
                    zoomable
                    className="rounded-xl border border-[#E2E8F0] bg-white/85 text-[#4A4139] shadow-sm backdrop-blur"
                  />
                  <Controls
                    position="bottom-right"
                    className="rounded-xl border border-[#E2E8F0] bg-white/85 text-[#4A4139] shadow-sm backdrop-blur"
                  />
                </ReactFlow>
              </div>
            </Panel>

            <ResizeHandle />

            <Panel
              ref={inspectorPanelRef}
              defaultSize={28}
              minSize={20}
              maxSize={45}
              collapsible
              collapsedSize={0}
              className="flex h-full min-w-0 flex-col overflow-hidden border-l border-[#E8E4DE] bg-[#FAF9F6] transition-[flex-grow,flex-basis,width] duration-200 ease-in-out"
            >
              <JourneyNodeInspector
                key={selectedNode?.id ?? 'no-selection'}
                node={selectedNode}
                onClose={handleInspectorClose}
                onDelete={handleRequestDeleteNode}
                onUpdate={handleUpdateNodeMeta}
                onOpenWhatsAppConfig={handleOpenWhatsAppConfig}
                onUpdateTriggerConfig={handleUpdateTriggerConfig}
                onTriggerStatusChange={handleTriggerStatusChange}
                onTriggerSave={handleTriggerSave}
                className="h-full"
              />
            </Panel>
          </PanelGroup>
        )}
      </div>
      <JourneySettingsDrawer
        open={settingsOpen}
        settings={journeySettings}
        onClose={() => setSettingsOpen(false)}
        onSave={settings => setJourneySettings(settings)}
      />
      {!unifiedTriggerEnabled ? (
        <TriggerConfigModal
          open={Boolean(activeModal?.type === 'trigger' && activeModalNode)}
          initialMeta={(activeModalNode?.data.meta as JourneyNodeData['meta']) || undefined}
          onClose={closeActiveModal}
          onSave={meta => {
            if (activeModal?.type === 'trigger' && activeModalNode) {
              handleUpdateNodeMeta(activeModal.nodeId, meta);
              setSelectedNodeId(activeModal.nodeId);
              closeActiveModal();
            }
          }}
        />
      ) : null}
      <WhatsAppActionModal
        open={Boolean(activeModal?.type === 'whatsapp' && activeModalNode)}
        journeyId={journeyId}
        nodeId={activeModal?.type === 'whatsapp' ? activeModal.nodeId : undefined}
        initialConfig={extractWhatsAppConfigFromMeta(
          (activeModalNode?.data.meta as JourneyNodeData['meta']) || undefined
        )}
        onClose={closeActiveModal}
        initialStep={activeModal?.type === 'whatsapp' ? activeModal.step : undefined}
        onSave={config => {
          if (activeModal?.type === 'whatsapp' && activeModalNode) {
            const existingMeta = (activeModalNode.data.meta as JourneyNodeData['meta']) || {};
            const nextMeta: JourneyNodeData['meta'] = {
              ...existingMeta,
              actionType: 'whatsapp',
              templateId: config.templateId,
              templateName: config.templateName,
              templateStatus: config.templateStatus,
              templateLanguage: config.templateLanguage,
              templateCategory: config.templateCategory,
              whatsappActionConfig: config,
              sendWindow: config.sendWindow,
              rateLimiting: config.rateLimiting,
              failureHandling: config.failureHandling,
              skipIfOptedOut: config.skipIfOptedOut,
              variableMappings: config.variableMappings,
              mediaUrl: config.mediaUrl,
              useDynamicMedia: config.useDynamicMedia,
              buttonActions: config.buttonActions,
              exitPaths: config.exitPaths, // Store exit paths for canvas rendering
              isConfigured: true,
            };
            if (typeof nextMeta.label !== 'string' || !nextMeta.label.trim()) {
              nextMeta.label = config.templateName || 'WhatsApp Message';
            }
            handleUpdateNodeMeta(activeModal.nodeId, nextMeta);
            setSelectedNodeId(activeModal.nodeId);
            closeActiveModal();
          }
        }}
        triggerContext="generic"
      />
      <DelayConfigModal
        open={Boolean(activeModal?.type === 'delay' && activeModalNode)}
        journeyId={journeyId}
        nodeId={activeModal?.type === 'delay' ? activeModal.nodeId : ''}
        initialConfig={
          ((activeModalNode?.data.meta as JourneyNodeData['meta'])?.delayConfig as DelayConfig | undefined) ??
          (activeModalNode?.data.delayConfig as DelayConfig | undefined)
        }
        onClose={closeActiveModal}
        onSave={config => {
          if (activeModal?.type === 'delay' && activeModalNode) {
            const existingMeta = (activeModalNode.data.meta as JourneyNodeData['meta']) || {};
            const waitForEventTimeout =
              config.delayType === 'wait_for_event' &&
              (config.specificConfig as WaitForEventConfig).onTimeout === 'branch_to_timeout_path';
            const waitForAttributeTimeout =
              config.delayType === 'wait_for_attribute' &&
              (config.specificConfig as WaitForAttributeConfig).onTimeout === 'branch_to_timeout_path';

        const timeoutBranchLabel =
          config.delayType === 'wait_for_event'
            ? (config.specificConfig as WaitForEventConfig).timeoutBranchLabel
            : config.delayType === 'wait_for_attribute'
              ? (config.specificConfig as WaitForAttributeConfig).timeoutBranchLabel
              : undefined;

            const nextMeta: JourneyNodeData['meta'] = {
              ...existingMeta,
              delayConfig: config,
              delayType: config.delayType,
              delaySummary: summariseDelayConfig(config),
              quietHoursEnabled: Boolean(config.quietHours?.enabled),
              skipWeekends: Boolean(config.holidaySettings?.skipWeekends),
              throttled: Boolean(config.throttling?.enabled),
              hasTimeoutBranch: waitForEventTimeout || waitForAttributeTimeout,
          timeoutBranchLabel,
              isConfigured: true,
            };

            handleUpdateNodeMeta(activeModal.nodeId, nextMeta);

            if (waitForEventTimeout || waitForAttributeTimeout) {
              setEdges(prevEdges =>
                prevEdges.map(edge => {
                  if (edge.source !== activeModal.nodeId) return edge;
                  if (edge.sourceHandle === 'timeout') {
                    return { ...edge, label: 'Timeout' };
                  }
                  return edge;
                })
              );
            }

            setSelectedNodeId(activeModal.nodeId);
            closeActiveModal();
          }
        }}
      />
      <ExperimentConfigModal
        isOpen={Boolean(activeModal?.type === 'experiment' && activeModalNode)}
        journeyId={journeyId}
        nodeId={activeModal?.type === 'experiment' ? activeModal.nodeId : ''}
        initialConfig={
          ((activeModalNode?.data.meta as JourneyNodeData['meta'])?.experimentConfig as ExperimentConfig | undefined) ??
          (activeModalNode?.data.experimentConfig as ExperimentConfig | undefined)
        }
        onClose={closeActiveModal}
        onSave={config => {
          if (activeModal?.type === 'experiment' && activeModalNode) {
            const existingMeta = (activeModalNode.data.meta as JourneyNodeData['meta']) || {};
            const variants = config.variants.map(variant => ({
              id: variant.id,
              label: variant.name,
              weight: variant.trafficAllocation,
              color: variant.color,
              description: variant.description,
              control: variant.isControl,
            }));
            const primaryGoal = config.goals.find(goal => goal.id === config.primaryGoalId);

            const nextMeta: JourneyNodeData['meta'] = {
              ...existingMeta,
              experimentConfig: config,
              experimentType: config.experimentType,
              experimentName: config.experimentName,
              experimentSummary: summariseExperimentConfig(config),
              primaryGoalId: config.primaryGoalId,
              primaryGoalName: primaryGoal?.name,
              sampleSize: config.sampleSize,
              winningCriteria: config.winningCriteria,
              variants,
              status: config.status,
              results: config.results,
              isConfigured: true,
            };

            if (typeof nextMeta.label !== 'string' || !nextMeta.label.trim()) {
              nextMeta.label = config.experimentName || 'Experiment';
            }

            handleUpdateNodeMeta(activeModal.nodeId, nextMeta);
            setSelectedNodeId(activeModal.nodeId);
            closeActiveModal();
          }
        }}
      />
      <ConditionConfigModal
        open={Boolean(activeModal?.type === 'condition' && activeModalNode)}
        journeyId={journeyId}
        nodeId={activeModal?.type === 'condition' ? activeModal.nodeId : undefined}
        initialConfig={
          ((activeModalNode?.data.meta as JourneyNodeData['meta'])?.conditionConfig as ConditionConfig | undefined) ??
          ((activeModalNode?.data.conditionConfig as ConditionConfig | undefined))
        }
        onClose={closeActiveModal}
        onSave={config => {
          if (activeModal?.type === 'condition' && activeModalNode) {
            const existingMeta = (activeModalNode.data.meta as JourneyNodeData['meta']) || {};
            const trueLabel = config.branches.true.customLabel?.trim() || config.branches.true.label;
            const falseLabel = config.branches.false.customLabel?.trim() || config.branches.false.label;
            const meta: JourneyNodeData['meta'] = {
              ...existingMeta,
              conditionConfig: config,
              trueLabel,
              falseLabel,
              isConfigured: true,
            };
            handleUpdateNodeMeta(activeModal.nodeId, meta);
            setEdges(prevEdges =>
              prevEdges.map(edge => {
                if (edge.source !== activeModal.nodeId) return edge;
                if (edge.sourceHandle === 'yes' || edge.sourceHandle === 'true') {
                  return { ...edge, label: trueLabel };
                }
                if (edge.sourceHandle === 'no' || edge.sourceHandle === 'false') {
                  return { ...edge, label: falseLabel };
                }
                return edge;
              }),
            );
            setSelectedNodeId(activeModal.nodeId);
            closeActiveModal();
          }
        }}
        testMode={journeySettings?.testMode}
      />
      <GoalConfigModal
        isOpen={Boolean(activeModal?.type === 'goal' && activeModalNode)}
        journeyId={journeyId}
        nodeId={activeModal?.type === 'goal' ? activeModal.nodeId : ''}
        initialConfig={
          ((activeModalNode?.data.meta as JourneyNodeData['meta'])?.goalConfig as GoalConfig | undefined) ??
          (activeModalNode?.data.goalConfig as GoalConfig | undefined)
        }
        onClose={closeActiveModal}
        onSave={goalConfig => {
          if (activeModal?.type === 'goal' && activeModalNode) {
            const existingMeta = (activeModalNode.data.meta as JourneyNodeData['meta']) || {};
            const nextMeta: JourneyNodeData['meta'] = {
              ...existingMeta,
              goalConfig,
              goalType: goalConfig.goalType,
              goalName: goalConfig.goalName,
              goalCategory: goalConfig.goalCategory,
              goalDescription: goalConfig.goalDescription,
              goalSummary: summariseGoalConfig(goalConfig),
              attributionWindow: goalConfig.attributionWindow,
              attributionModel: goalConfig.attributionModel,
              exitAfterGoal: goalConfig.exitAfterGoal,
              markAsCompleted: goalConfig.markAsCompleted,
              countMultipleConversions: goalConfig.countMultipleConversions,
              isConfigured: true,
            };
            handleUpdateNodeMeta(activeModal.nodeId, nextMeta);
            setSelectedNodeId(activeModal.nodeId);
            closeActiveModal();
          }
        }}
      />
      <TestUserPanel
        open={testUsersPanelOpen}
        onClose={() => setTestUsersPanelOpen(false)}
        testUsers={testUsers}
        onAddUser={handleAddTestUser}
        onRemoveUser={handleRemoveTestUser}
        onClearAll={handleClearTestUsers}
        onImportCsv={() => toast.info('CSV import coming soon')}
      />
      <ExecutionLogModal
        open={executionLogModal.open}
        onClose={closeExecutionLogModal}
        logs={executionLogEntriesForModal}
        testUserLabel={executionLogUserLabel}
        onGoToNode={handleGoToNodeFromExecution}
      />
      <ValidationModal
        open={validationModalOpen}
        isLoading={isValidating}
        errors={[...validationErrors, ...validationWarnings]}
        onClose={handleValidationModalClose}
        onGoToNode={handleGoToNodeFromValidation}
        onActivate={validationErrors.length === 0 && validationWarnings.length === 0 ? handleProceedActivation : undefined}
        onActivateAnyway={validationErrors.length === 0 && validationWarnings.length > 0 ? handleProceedActivation : undefined}
      />
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={handleCloseDeleteConfirm}
        title="Delete Node?"
        subtitle={`Are you sure you want to delete "${deleteConfirm.nodeName}"? This will also remove all connections.`}
        size="sm"
        showCloseButton
        closeOnOverlay
      >
        <p className="text-sm text-[#8B7F76]">
          This action cannot be undone. Any logic depending on this node will stop working until you reconnect the
          flow.
        </p>
        <div className="mt-8 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
            onClick={handleCloseDeleteConfirm}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#C8998F] text-white hover:bg-[#B5837A]"
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ResizeHandle({ className }: { className?: string }) {
  return (
    <PanelResizeHandle
      className={cn(
        'group relative w-2 cursor-col-resize bg-transparent transition-colors hover:bg-[#C6D7FF]/30',
        className,
      )}
    >
      <div className="pointer-events-none flex h-12 items-center justify-center">
        <div className="flex h-8 w-6 items-center justify-center rounded-md bg-white/90 shadow-sm ring-1 ring-[#E1D8CF] transition group-hover:bg-white group-hover:ring-[#8EA9FF]">
          <GripVertical className="h-4 w-4 text-[#B8977F] transition-colors group-hover:text-[#4971FF]" />
        </div>
      </div>
    </PanelResizeHandle>
  );
}

export function JourneyBuilder({ journeyId }: { journeyId: string }) {
  return (
    <ReactFlowProvider>
      <JourneyBuilderInner journeyId={journeyId} />
    </ReactFlowProvider>
  );
}


