"use client";

import type { ComponentType, MouseEvent, ReactNode } from 'react';
import { Fragment, memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Award,
  Bell,
  CalendarX,
  Clock3,
  Copy,
  FlaskConical,
  Flag,
  GitBranch,
  GaugeCircle,
  Mail,
  MessageCircle,
  MessageSquareMore,
  Pencil,
  RefreshCcw,
  Send,
  Sparkles,
  Moon,
  Target,
  Ticket,
  Trash2,
  Trophy,
  Timer,
  Globe,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { isUnifiedTriggerEnabled } from '@/lib/featureFlags';
import type { UnifiedTriggerNodeData } from '@/lib/types/journey';
import type { JourneyPaletteNodeVariant } from './nodeCatalog';
import { Badge } from '@/components/ui/badge';
import type { ExperimentConfig } from '@/lib/types/experiment-config';
import type { DelayType } from '@/lib/types/delay-config';
import type { GoalConfig } from '@/lib/types/goal-config';
import { TriggerNodeDisplay } from './trigger/TriggerNodeDisplay';

interface JourneyNodeCallbacks {
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

type JsonMap = Record<string, unknown>;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const isJsonMap = (value: unknown): value is JsonMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface JourneyNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  subtype?: string;
  variant: JourneyPaletteNodeVariant;
  icon?: ComponentType<{ className?: string }>;
  meta?: JsonMap;
  experimentConfig?: ExperimentConfig;
  experimentType?: string;
  variantCount?: number;
  goalConfig?: GoalConfig;
  isConfigured?: boolean;
  callbacks?: JourneyNodeCallbacks;
  triggerConfig?: UnifiedTriggerNodeData["triggerConfig"];
  status?: string;
  userCount?: number;
}

interface BuilderNodeProps {
  id: string;
  data: JourneyNodeData;
  selected?: boolean;
}

const variantTokens: Record<
  JourneyPaletteNodeVariant,
  {
    border: string;
    accent: string;
    iconBg: string;
    headerBg: string;
    headerBorder: string;
    badge: string;
    ring: string;
    glow: string;
  }
> = {
  trigger: {
    border: '#6EE7B7',
    accent: '#059669',
    iconBg: 'bg-emerald-50 text-emerald-600',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
    headerBorder: 'border-emerald-100/80',
    badge: 'bg-emerald-500 text-white',
    ring: 'ring-emerald-300',
    glow: 'shadow-emerald-100',
  },
  action: {
    border: '#93C5FD',
    accent: '#2563EB',
    iconBg: 'bg-blue-50 text-blue-600',
    headerBg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
    headerBorder: 'border-blue-100/80',
    badge: 'bg-blue-500 text-white',
    ring: 'ring-blue-300',
    glow: 'shadow-blue-100',
  },
  decision: {
    border: '#FCD34D',
    accent: '#D97706',
    iconBg: 'bg-amber-50 text-amber-600',
    headerBg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
    headerBorder: 'border-amber-100/80',
    badge: 'bg-amber-500 text-white',
    ring: 'ring-amber-300',
    glow: 'shadow-amber-100',
  },
  experiment: {
    border: '#C4B5FD',
    accent: '#7C3AED',
    iconBg: 'bg-violet-50 text-violet-600',
    headerBg: 'bg-gradient-to-r from-violet-50 to-purple-50',
    headerBorder: 'border-violet-100/80',
    badge: 'bg-violet-500 text-white',
    ring: 'ring-violet-300',
    glow: 'shadow-violet-100',
  },
  wait: {
    border: '#D1D5DB',
    accent: '#6B7280',
    iconBg: 'bg-slate-50 text-slate-500',
    headerBg: 'bg-gradient-to-r from-slate-50 to-gray-50',
    headerBorder: 'border-slate-100/80',
    badge: 'bg-slate-500 text-white',
    ring: 'ring-slate-300',
    glow: 'shadow-slate-100',
  },
  goal: {
    border: '#FDBA74',
    accent: '#EA580C',
    iconBg: 'bg-orange-50 text-orange-600',
    headerBg: 'bg-gradient-to-r from-orange-50 to-amber-50',
    headerBorder: 'border-orange-100/80',
    badge: 'bg-orange-500 text-white',
    ring: 'ring-orange-300',
    glow: 'shadow-orange-100',
  },
};

const ACTION_TYPE_LABELS: Record<string, { label: string; detail: string }> = {
  whatsapp: { label: 'WhatsApp Message', detail: 'Send a templated WhatsApp notification' },
  email: { label: 'Email', detail: 'Deliver a branded email to the customer' },
  sms: { label: 'SMS', detail: 'Send a concise text update' },
  add_tag: { label: 'Add Tag', detail: 'Attach a tag for future targeting' },
  update_property: { label: 'Update Property', detail: 'Modify customer attributes' },
  generate_discount: { label: 'Generate Discount', detail: 'Auto-create a unique Shopify discount code' },
  http_webhook: { label: 'HTTP Webhook', detail: 'Send customer data to an external URL' },
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  journey_completion: 'Journey Completion',
  shopify_event: 'Shopify Event',
  whatsapp_engagement: 'WhatsApp Engagement',
  custom_event: 'Custom Event',
  segment_entry: 'Segment Entry',
  conversion: 'Conversion',
};

function collectSummary(meta: JsonMap | undefined, subtype?: string): string[] {
  if (!meta) return [];
  const summary: string[] = [];

  if (typeof meta.goalSummary === 'string') summary.push(meta.goalSummary);
  if (typeof meta.delaySummary === 'string') summary.push(meta.delaySummary);
  if (meta.quietHoursEnabled) summary.push('Quiet hours respected');
  if (meta.skipWeekends) summary.push('Skips weekends');
  if (meta.throttled) summary.push('Throttling enabled');
  const segmentName = typeof meta.segmentName === 'string' ? meta.segmentName : undefined;
  const segmentId = typeof meta.segmentId === 'string' ? meta.segmentId : undefined;
  if (segmentName || segmentId) summary.push(`Segment • ${segmentName || segmentId}`);
  if (typeof meta.webhookEvent === 'string') summary.push(`Event • ${meta.webhookEvent}`);
  if (typeof meta.templateName === 'string') summary.push(`Template • ${meta.templateName}`);
  if (meta.delayMode === 'until' && typeof meta.waitUntil === 'string') {
    summary.push(`Until • ${new Date(meta.waitUntil).toLocaleString()}`);
  }
  if (meta.delayMode === 'event' && typeof meta.eventName === 'string') {
    summary.push(`Wait for • ${meta.eventName}`);
  }
  const locationField = typeof meta.locationField === 'string' ? meta.locationField : undefined;
  const locationValue = typeof meta.locationValue === 'string' ? meta.locationValue : undefined;
  if (locationField && locationValue) {
    summary.push(`Location • ${locationField}: ${locationValue}`);
  }
  const orderValueOperator = typeof meta.orderValueOperator === 'string' ? meta.orderValueOperator : undefined;
  const orderValueAmount =
    typeof meta.orderValueAmount === 'number' || typeof meta.orderValueAmount === 'string'
      ? meta.orderValueAmount
      : undefined;
  if (orderValueOperator && orderValueAmount) {
    const operatorLabel = orderValueOperator === 'gt' ? '>' : orderValueOperator === 'lt' ? '<' : '=';
    summary.push(`Order value ${operatorLabel} ${orderValueAmount}`);
  }
  if (meta.variableMappings && typeof meta.variableMappings === 'object') {
    const count = Object.keys(meta.variableMappings as object).length;
    if (count > 0) summary.push(`Variables mapped • ${count}`);
  }
  const triggerConfiguration = meta.triggerConfiguration;
  if (triggerConfiguration && typeof triggerConfiguration === 'object') {
    const targetSegment = (triggerConfiguration as { targetSegment?: unknown }).targetSegment as {
      rules?: Array<{
        eventName?: string;
        timeFrame?: { period?: string; customDays?: number };
        conditions?: unknown[];
      }>;
    } | undefined;
    const firstRule = targetSegment?.rules?.[0];
    if (firstRule?.eventName) {
      summary.push(`Event • ${firstRule.eventName.replace(/_/g, ' ')}`);
    }
    if (firstRule?.timeFrame?.period) {
      const { period, customDays } = firstRule.timeFrame;
      const timeframeLabel =
        period === 'last_24_hours'
          ? 'Last 24 hours'
          : period === 'last_7_days'
            ? 'Last 7 days'
            : period === 'last_30_days'
              ? 'Last 30 days'
              : period === 'custom' && typeof customDays === 'number'
                ? `Last ${customDays} day${customDays === 1 ? '' : 's'}`
                : undefined;
      if (timeframeLabel) summary.push(timeframeLabel);
    }
    if (Array.isArray(firstRule?.conditions) && firstRule?.conditions.length) {
      summary.push(`Filters • ${firstRule.conditions.length}`);
    }
  }
  if (typeof meta.conditionSummary === 'string') summary.push(meta.conditionSummary);
  else if (typeof meta.conditionType === 'string') summary.push(`Condition • ${meta.conditionType}`);
  if (typeof meta.goalDescription === 'string') summary.push(meta.goalDescription);
  if (meta.hours && subtype === 'abandoned_cart') summary.push(`Delay • ${meta.hours} hrs`);
  if (typeof meta.previewCount === 'number') summary.push(`${meta.previewCount.toLocaleString()} customers (est.)`);
  if (typeof meta.goalSummary === 'string') summary.push(meta.goalSummary);

  if (summary.length === 0 && typeof meta.label === 'string') summary.push(meta.label);
  return summary.slice(0, 3);
}

function StatusBar({ meta }: { meta?: JsonMap }) {
  const status = typeof meta?.status === 'string' ? meta.status : 'Draft';

  let customers: number | undefined;
  const customersReached = getNumber(meta?.customersReached);
  if (typeof customersReached === 'number') {
    customers = customersReached;
  } else if (isJsonMap(meta?.stats)) {
    const stats = meta?.stats as JsonMap;
    const statsCustomers = getNumber(stats.customersReached);
    if (typeof statsCustomers === 'number') {
      customers = statsCustomers;
    }
  }

  const isTestMode = Boolean(meta?.testModeActive);
  const testUsersCount = getNumber(meta?.testUsersCount);

  const tone = (() => {
    const lowered = status.toLowerCase();
    if (lowered.includes('warn')) return '#D9B088';
    if (lowered.includes('risk') || lowered.includes('error')) return '#C8998F';
    if (lowered.includes('active') || lowered.includes('live')) return '#7FA17A';
    return '#8B7F76';
  })();

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-700">
      {/* Improved text visibility: Larger fonts, better contrast */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tone }} />
          {status}
        </span>
        {customers ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <MessageSquareMore className="h-3.5 w-3.5" />
            {customers.toLocaleString()} reached
          </span>
        ) : null}
      </div>
      {isTestMode ? (
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 border border-amber-200">
            <FlaskConical className="h-4 w-4" />
            Test Mode
          </span>
          {typeof testUsersCount === 'number' ? (
            <span className="font-medium">
              {testUsersCount} test {testUsersCount === 1 ? 'user' : 'users'}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface NodeShellProps extends BuilderNodeProps {
  children: ReactNode;
  footer?: ReactNode;
  handles?: ReactNode;
  pill?: boolean;
  variantOverride?: JourneyPaletteNodeVariant;
}

const NodeShell = ({
  id,
  data,
  selected,
  children,
  footer,
  handles,
  pill = false,
  variantOverride,
}: NodeShellProps) => {
  const variant = variantOverride ?? data.variant;
  const token = variantTokens[variant];
  const Icon = typeof data.icon === 'function' ? data.icon : undefined;
  const meta = data.meta ?? {};
  const summary = useMemo(() => collectSummary(meta, data.subtype), [meta, data.subtype]);
  const actionTypeLabel = getString(meta.actionType)?.replace(/_/g, ' ');

  // Handle action button clicks (Edit, Delete, Duplicate)
  // Properly stops event propagation to prevent node selection when clicking buttons
  const handleAction = (action: keyof JourneyNodeCallbacks, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent node click/selection
    event.preventDefault(); // Prevent any default behavior
    
    // Call the callback if it exists
    const callback = data.callbacks?.[action];
    if (callback && typeof callback === 'function') {
      callback(id);
    } else {
      console.warn(`Callback ${action} not available for node ${id}`);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex w-[260px] max-w-[360px] min-h-[100px] flex-col rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5',
        pill ? 'px-5 py-3.5' : 'overflow-hidden',
        selected ? `ring-2 ring-offset-2 ${token.ring} shadow-xl ${token.glow}` : 'shadow-md hover:shadow-lg'
      )}
      style={{ borderColor: token.border }}
    >
      {pill ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3">
            {Icon ? (
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', token.iconBg)}>
                <Icon className="h-5 w-5" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1 text-center">
              {/* Improved text visibility for pill nodes */}
              <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">{data.label}</p>
              {getNumber(meta.duration) || getString(meta.unit) ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  Wait • {getNumber(meta.duration) ?? 1} {getString(meta.unit) ?? 'hours'}
                </p>
              ) : null}
            </div>
          </div>
          {handles}
        </div>
      ) : (
        <>
          <div
            className={cn(
              'flex items-center justify-between gap-3 border-b px-4 py-3',
              token.headerBg,
              token.headerBorder
            )}
          >
            <div className="flex items-center gap-3">
              {Icon ? (
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', token.iconBg)}>
                  <Icon className="h-5 w-5" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                {/* Improved text visibility: Larger font, better contrast, multi-line support */}
                <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">{data.label}</p>
                {data.description ? (
                  <p className="line-clamp-2 mt-1 text-sm leading-relaxed text-slate-700">{data.description}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-[11px] font-semibold uppercase', token.badge)}>
                {data.variant === 'action'
                  ? actionTypeLabel || 'Action'
                  : data.variant === 'goal'
                    ? 'Goal'
                    : data.variant === 'decision'
                      ? 'Condition'
                      : data.variant === 'experiment'
                        ? 'Experiment'
                        : data.variant === 'trigger'
                          ? 'Trigger'
                          : 'Node'}
              </Badge>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={event => handleAction('onEdit', event)}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-700"
                  aria-label="Edit node"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={event => handleAction('onDuplicate', event)}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-700"
                  aria-label="Duplicate node"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={event => handleAction('onDelete', event)}
                  className="rounded-lg p-1 text-red-400 transition hover:bg-white hover:text-red-500"
                  aria-label="Delete node"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content area: Removed max-height restriction, improved padding for better readability */}
          <div className="px-4 py-4 min-h-[100px]">{children}</div>
          {handles}

          {footer != null ? (
            footer
          ) : (
            <>
              {summary.length > 0 ? (
                <div className="px-4 pb-4">
                  {/* Configuration summary: Improved text size and multi-line support */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    <ul className="space-y-1.5">
                      {summary.map((item, index) => (
                        // Use index suffix to ensure key uniqueness when summary contains duplicate values
                        <li key={`${item}-${index}`} className="line-clamp-2 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              <div className="px-4 pb-4">
                <StatusBar meta={meta} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const handleStyle = (accent: string) => ({
  width: 12,
  height: 12,
  borderRadius: '9999px',
  background: '#FFFFFF',
  border: `2px solid ${accent}`,
  transition: 'transform 150ms ease',
});

const BaseNode = memo(function BaseNode({ id, data, selected }: BuilderNodeProps) {
  const token = variantTokens[data.variant];
  const meta = data.meta ?? {};

  // Check if this is a WhatsApp node with exit paths configured
  const isWhatsAppNode = data.variant === 'action' && 
    (getString(meta.actionType) === 'send_whatsapp' || data.subtype === 'send_whatsapp');
  
  const exitPaths = isWhatsAppNode && isJsonMap(meta.exitPaths) 
    ? (meta.exitPaths as any)
    : null;

  // Build exit path handles for WhatsApp nodes
  const exitPathHandles: ReactNode[] = [];
  const exitPathLabels: ReactNode[] = [];
  
  if (exitPaths && isWhatsAppNode) {
    const exitPathTypes: Array<{ key: string; label: string; color: string }> = [
      { key: 'sent', label: 'Sent', color: 'blue' },
      { key: 'delivered', label: 'Delivered', color: 'green' },
      { key: 'read', label: 'Read', color: 'purple' },
      { key: 'replied', label: 'Replied', color: 'indigo' },
      { key: 'failed', label: 'Failed', color: 'red' },
      { key: 'unreachable', label: 'Unreachable', color: 'orange' },
    ];

    // Handle button clicked paths (array)
    if (Array.isArray(exitPaths.buttonClicked)) {
      exitPaths.buttonClicked.forEach((buttonPath: any, index: number) => {
        if (buttonPath?.enabled && buttonPath?.action?.type === 'branch' && buttonPath?.action?.branchId) {
          const buttonLabel = buttonPath.buttonConfig?.buttonText || `Button ${index + 1}`;
          exitPathTypes.push({
            key: `button_${buttonPath.buttonConfig?.buttonId || index}`,
            label: buttonLabel,
            color: 'violet',
          });
        }
      });
    }

    // Filter to only enabled exit paths with branch actions
    const enabledExitPaths = exitPathTypes.filter(({ key }) => {
      if (key.startsWith('button_')) {
        const buttonId = key.replace('button_', '');
        const buttonPath = Array.isArray(exitPaths.buttonClicked)
          ? exitPaths.buttonClicked.find((p: any) => p.buttonConfig?.buttonId === buttonId)
          : null;
        return buttonPath?.enabled && buttonPath?.action?.type === 'branch';
      }
      const path = exitPaths[key];
      return path?.enabled && path?.action?.type === 'branch';
    });

    // Render handles for enabled exit paths
    enabledExitPaths.forEach((exitPath, index) => {
      const totalPaths = enabledExitPaths.length;
      const topPercent = totalPaths === 1 
        ? 50 
        : 30 + (index / (totalPaths - 1)) * 40; // Distribute between 30% and 70%

      const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-50 text-green-700',
        purple: 'bg-purple-50 text-purple-700',
        indigo: 'bg-indigo-50 text-indigo-700',
        red: 'bg-red-50 text-red-700',
        orange: 'bg-orange-50 text-orange-700',
        violet: 'bg-violet-50 text-violet-700',
      };

      exitPathHandles.push(
        <Handle
          key={exitPath.key}
          type="source"
          id={exitPath.key}
          position={Position.Right}
          style={{ ...handleStyle(token.accent), top: `${topPercent}%` }}
          className="-right-4 hover:scale-125"
        />
      );

      exitPathLabels.push(
        <div
          key={`label_${exitPath.key}`}
          className={`pointer-events-none absolute right-[-100px] flex h-6 items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide shadow ${colorMap[exitPath.color] || 'bg-slate-50 text-slate-700'}`}
          style={{ top: `calc(${topPercent}% - 12px)` }}
        >
          {exitPath.label}
        </div>
      );
    });
  }

  const handles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle(token.accent)}
        className="-left-4 top-1/2 hover:scale-125"
      />
      {exitPathHandles.length > 0 ? (
        <>
          {exitPathHandles}
          {exitPathLabels}
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle(token.accent)}
          className="-right-4 top-1/2 hover:scale-125"
        />
      )}
    </>
  );

  let body: ReactNode = null;

  if (data.variant === 'trigger') {
    if (isUnifiedTriggerEnabled()) {
      body = (
        <TriggerNodeDisplay
          data={data}
          onEdit={data.callbacks?.onEdit ? () => data.callbacks?.onEdit?.(id) : undefined}
          onDuplicate={data.callbacks?.onDuplicate ? () => data.callbacks?.onDuplicate?.(id) : undefined}
        />
      );
    } else {
      const triggerType = getString(meta.triggerType) ?? data.subtype ?? 'journey_trigger';
      const triggerLabel = triggerType.replace(/_/g, ' ');
      const segmentLabel = getString(meta.segmentName) ?? getString(meta.segmentId);
      const webhookEvent = getString(meta.webhookEvent);
      const previewCount = getNumber(meta.previewCount);

      body = (
        <div className="space-y-3">
          {/* Improved text visibility: Larger fonts, better contrast */}
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600" />
            <span className="text-base font-semibold text-slate-900 capitalize">{triggerLabel}</span>
          </div>
          {segmentLabel ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
              Segment • <span className="font-semibold">{segmentLabel}</span>
            </div>
          ) : null}
          {webhookEvent ? (
            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm font-medium text-emerald-800">
              Event • <span className="font-semibold">{webhookEvent}</span>
            </div>
          ) : null}
          {typeof previewCount === 'number' ? (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <MessageSquareMore className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Estimated reach • {previewCount.toLocaleString()} customers</span>
            </div>
          ) : null}
        </div>
      );
    }
  } else if (data.variant === 'action') {
    const actionType = getString(meta.actionType) ?? data.subtype ?? 'whatsapp';
    const info = ACTION_TYPE_LABELS[actionType] ?? ACTION_TYPE_LABELS.whatsapp;
    const ChannelIcon = actionType === 'email' ? Mail : actionType === 'sms' ? Send : actionType === 'generate_discount' ? Ticket : actionType === 'http_webhook' ? Globe : MessageCircle;
    const timingLabel =
      getString(meta.timing) ??
      getString(meta.delayLabel) ??
      (getString(meta.sendWindowStart) && getString(meta.sendWindowEnd)
        ? `Window • ${getString(meta.sendWindowStart)}-${getString(meta.sendWindowEnd)}`
        : null);
    const templateContent = getString(meta.templateName) ?? getString(meta.message) ?? 'Configure message content';
    const variableMappings = isJsonMap(meta.variableMappings) ? meta.variableMappings : undefined;
    const variableCount = variableMappings ? Object.keys(variableMappings).length : 0;

    body = (
      <div className="space-y-3">
        {/* Improved text visibility: Larger fonts, better contrast, multi-line support */}
        <div>
          <div className="flex items-center gap-2">
            <ChannelIcon className="h-5 w-5 text-blue-500" />
            <p className="text-base font-semibold text-slate-900">{info.label}</p>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-700">{info.detail}</p>
        </div>
        {/* Template content: Larger, more readable */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-blue-800">{templateContent}</p>
        </div>
        {timingLabel ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Clock3 className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{timingLabel}</span>
          </div>
        ) : null}
        {variableCount > 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Flag className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Variables mapped • {variableCount}</span>
          </div>
        ) : null}
      </div>
    );
  } else if (data.variant === 'goal') {
    const goalType = getString(meta.goalType) ?? 'journey_completion';
    const goalLabel = GOAL_TYPE_LABELS[goalType] ?? GOAL_TYPE_LABELS.conversion;
    const attributionWindowValue = isJsonMap(meta.attributionWindow) ? getNumber((meta.attributionWindow as JsonMap).value) : undefined;
    const attributionWindowUnit = isJsonMap(meta.attributionWindow) ? getString((meta.attributionWindow as JsonMap).unit) : undefined;
    const attributionWindow =
      attributionWindowValue !== undefined && attributionWindowUnit ? `${attributionWindowValue} ${attributionWindowUnit}` : undefined;
    const exitBehavior = meta.exitAfterGoal ? 'Exits journey' : 'Continues journey';
    const goalName = getString(meta.goalName) ?? goalLabel;
    const goalDescription = getString(meta.goalDescription) ?? 'Track conversions after this point.';
    const goalCategory = getString(meta.goalCategory);
    const attributionModel = getString(meta.attributionModel) ?? 'last touch';

    body = (
      <div className="space-y-3">
        {/* Improved text visibility: Larger fonts, better contrast */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-base font-bold text-slate-900">{goalName}</p>
              <p className="mt-1 text-xs font-medium text-slate-600 uppercase tracking-wide">{goalLabel}</p>
            </div>
          </div>
          {goalCategory ? (
            <Badge variant="secondary" className="bg-orange-100 text-xs font-semibold uppercase tracking-wide text-orange-700">
              {goalCategory}
            </Badge>
          ) : null}
        </div>
        <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-orange-800">{goalDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          {attributionWindow ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3 text-orange-500" />
              {attributionWindow} window
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Flag className="h-3 w-3 text-orange-500" />
            {attributionModel.replace('_', ' ')}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase text-orange-600">
            {exitBehavior}
          </Badge>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="text-sm leading-relaxed text-slate-700">
        {data.description || 'Configure this step to continue the journey.'}
      </div>
    );
  }

  return (
    <NodeShell
      id={id}
      data={data}
      selected={selected}
      handles={handles}
    >
      {body}
    </NodeShell>
  );
});

const delayTypeIconMap: Partial<Record<DelayType, ComponentType<{ className?: string }>>> = {
  fixed_time: Timer,
  wait_until_time: Clock3,
  wait_for_event: Bell,
  optimal_send_time: Sparkles,
  wait_for_attribute: RefreshCcw,
};

const delayTypeLabelMap: Record<DelayType, string> = {
  fixed_time: 'Fixed delay',
  wait_until_time: 'Wait until time',
  wait_for_event: 'Wait for event',
  optimal_send_time: 'Optimal send time',
  wait_for_attribute: 'Wait for attribute',
};

const WaitNode = memo(function WaitNode({ id, data, selected }: BuilderNodeProps) {
  const token = variantTokens[data.variant];
  const meta = data.meta ?? {};
  const delayTypeValue = getString(meta.delayType);
  const delayType = (delayTypeValue as DelayType) ?? 'fixed_time';
  const DelayIcon = delayTypeIconMap[delayType] ?? Timer;
  const summary = getString(meta.delaySummary) ?? 'Delay not yet configured';

  const advancedFlags: Array<{ label: string; icon: ComponentType<{ className?: string }> }> = [];
  if (meta.quietHoursEnabled) {
    advancedFlags.push({ label: 'Quiet hours', icon: Moon });
  }
  if (meta.skipWeekends) {
    advancedFlags.push({ label: 'Skip weekends', icon: CalendarX });
  }
  if (meta.throttled) {
    advancedFlags.push({ label: 'Throttled', icon: GaugeCircle });
  }
  if (meta.hasTimeoutBranch) {
    advancedFlags.push({ label: getString(meta.timeoutBranchLabel) ?? 'Timeout branch', icon: Bell });
  }

  const handles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle(token.accent)}
        className="-left-5 top-1/2 hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...handleStyle(token.accent), top: meta.hasTimeoutBranch ? '40%' : '50%' }}
        className="-right-5 hover:scale-125"
      />
      {meta.hasTimeoutBranch ? (
        <>
          <Handle
            type="source"
            id="timeout"
            position={Position.Right}
            style={{ ...handleStyle(token.accent), top: '70%' }}
            className="-right-5 hover:scale-125"
          />
          <div className="pointer-events-none absolute right-[-88px] top-[67%] flex h-6 items-center rounded-full bg-rose-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-rose-600 shadow">
            Timeout
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <NodeShell id={id} data={data} selected={selected} handles={handles}>
      <div className="space-y-3">
        {/* Improved text visibility: Larger fonts, better contrast, multi-line support */}
        <div className="flex items-start gap-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', token.iconBg)}>
            <DelayIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">{delayTypeLabelMap[delayType]}</p>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-700">{summary}</p>
          </div>
        </div>
        {advancedFlags.length ? (
          <div className="flex flex-wrap gap-2">
            {advancedFlags.map(flag => (
              <Badge
                key={flag.label}
                variant="secondary"
                className="flex items-center gap-1 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                <flag.icon className="h-3.5 w-3.5" />
                {flag.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No advanced options enabled.</p>
        )}
      </div>
    </NodeShell>
  );
});

const DecisionNode = memo(function DecisionNode({ id, data, selected }: BuilderNodeProps) {
  const token = variantTokens[data.variant];
  const meta = data.meta ?? {};
  const conditions = Array.isArray(meta.conditions)
    ? meta.conditions.filter(isJsonMap) as JsonMap[]
    : [];

  const handles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle(token.accent)}
        className="-left-4 top-1/2 hover:scale-125"
      />
      <Handle
        type="source"
        id="yes"
        position={Position.Right}
        style={{ ...handleStyle(token.accent), top: '40%' }}
        className="-right-4 hover:scale-125"
      />
      <Handle
        type="source"
        id="no"
        position={Position.Right}
        style={{ ...handleStyle(token.accent), top: '60%' }}
        className="-right-4 hover:scale-125"
      />
      <div className="pointer-events-none absolute right-[-84px] top-[38%] flex h-6 items-center rounded-full bg-amber-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-amber-700 shadow">
        Yes
      </div>
      <div className="pointer-events-none absolute right-[-84px] top-[58%] flex h-6 items-center rounded-full bg-rose-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-rose-600 shadow">
        No
      </div>
    </>
  );

  const summary = meta.conditionSummary as string | undefined;

  return (
    <NodeShell id={id} data={data} selected={selected} handles={handles} variantOverride="decision">
      <div className="space-y-3">
        {/* Improved text visibility: Larger fonts, better contrast */}
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-amber-600" />
          <span className="text-base font-semibold text-slate-900">Conditional Branch</span>
        </div>
        {summary ? (
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-amber-800">
            {summary}
          </p>
          ) : null}
        {conditions.length ? (
          <div className="space-y-2 rounded-lg border border-amber-100 bg-white px-3 py-2.5 text-sm text-slate-700">
            {conditions.slice(0, 3).map((condition, index) => {
              const field = getString(condition.field) ?? 'Attribute';
              const operator = getString(condition.operator) ?? 'is';
              const rawValue = condition.value;
              const value =
                getString(rawValue) ??
                (Array.isArray(rawValue) ? rawValue.map(item => String(item)).join(', ') : getNumber(rawValue)?.toString() ?? '?');
              return (
                <div key={`${field}_${index}`} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="line-clamp-2 font-medium">
                    {field} {operator} {value}
                  </span>
                </div>
              );
            })}
            {conditions.length > 3 ? (
              <div className="text-xs font-semibold uppercase text-amber-700">
                +{conditions.length - 3} more
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Define rules to split customers by behaviour.</p>
        )}
      </div>
    </NodeShell>
  );
});

const ExperimentNode = memo(function ExperimentNode({ id, data, selected }: BuilderNodeProps) {
  const token = variantTokens.experiment;
  const meta = data.meta ?? {};
  const experiment = data.experimentConfig ?? (meta.experimentConfig as ExperimentConfig | undefined);
  const metaVariants = Array.isArray(meta.variants)
    ? (meta.variants.filter(isJsonMap) as Array<JsonMap>)
        .map((variant, index) => ({
          id: getString(variant.id) ?? `variant_${index}`,
          label: getString(variant.label) ?? `Variant ${String.fromCharCode(65 + index)}`,
          weight: getNumber(variant.weight) ?? 0,
          color: getString(variant.color),
          control: Boolean(variant.control),
          description: getString(variant.description),
        }))
    : undefined;

  const defaultVariants = metaVariants ?? [
    { id: 'variant_a', label: 'Variant A', weight: 50, color: '#6366F1', control: true },
    { id: 'variant_b', label: 'Variant B', weight: 50, color: '#F59E0B', control: false },
  ];

  const variants = experiment
    ? experiment.variants.map((variant, index) => ({
        id: variant.id,
        label: variant.name,
        weight: variant.trafficAllocation,
        color: variant.color ?? defaultVariants[index % defaultVariants.length]?.color ?? '#6366F1',
        control: variant.isControl,
        description: variant.description,
      }))
    : defaultVariants;
  const totalWeight = variants.reduce(
    (sum, variant) => sum + (Number.isFinite(variant.weight) ? (variant.weight as number) : 0),
    0,
  );
  const primaryGoal =
    experiment?.goals.find(goal => goal.id === experiment.primaryGoalId) ??
    (getString(meta.primaryGoalName) ? { name: getString(meta.primaryGoalName) } : null);
  const status = experiment?.status?.status ?? getString((isJsonMap(meta.status) ? (meta.status as JsonMap).status : meta.status)) ?? 'draft';
  const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
  const winner =
    experiment?.status?.winnerDeclared && experiment.status?.winningVariantId
      ? experiment.variants.find(variant => variant.id === experiment.status?.winningVariantId)
      : null;
  const sampleResult = experiment?.sampleSize?.result ?? (isJsonMap(meta.sampleSize) && isJsonMap((meta.sampleSize as JsonMap).result)
    ? ((meta.sampleSize as JsonMap).result as ExperimentConfig['sampleSize']['result'])
    : undefined);

  const handles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle(token.accent)}
        className="-left-4 top-1/2 hover:scale-125"
      />
      {variants.map((variant, index) => {
        const topPercent = ((index + 1) / (variants.length + 1)) * 100;
        const handleId = variant.id || `variant_${index}`;
        const label = variant.label || `Variant ${String.fromCharCode(65 + index)}`;
        return (
          <Fragment key={handleId}>
            <Handle
              type="source"
              id={handleId}
              position={Position.Right}
              style={{ ...handleStyle(token.accent), top: `${topPercent}%` }}
              className="-right-4 hover:scale-125"
            />
            <div
              className="pointer-events-none absolute right-[-112px] flex h-6 items-center gap-2 rounded-full bg-violet-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-violet-700 shadow"
              style={{ top: `calc(${topPercent}% - 12px)` }}
            >
              <span>{label}</span>
              {variant.control ? <span className="rounded-md bg-white px-2 py-[1px] text-[10px] font-bold text-violet-600">Control</span> : null}
            </div>
          </Fragment>
        );
      })}
    </>
  );

  return (
    <NodeShell
      id={id}
      data={data}
      selected={selected}
      handles={handles}
      variantOverride="experiment"
      footer={
        <div className="px-4 pb-4 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <span className="font-semibold text-violet-600">{statusLabel}</span>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Improved text visibility: Larger fonts, better contrast */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-violet-600" />
              <span className="text-base font-semibold text-slate-900">
                {experiment?.experimentName || (meta.experimentName as string) || 'Experiment'}
              </span>
            </div>
            <p className="line-clamp-2 text-sm leading-relaxed text-slate-700">
              {experiment?.hypothesis || (meta.experimentSummary as string) || 'Configure variants and goals to begin testing.'}
            </p>
          </div>
          <Badge className="bg-violet-100 text-xs font-semibold uppercase text-violet-700 flex-shrink-0">
            {(experiment?.experimentType || (meta.experimentType as string) || 'A/B Test').replace(/_/g, ' ')}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Target className="h-4 w-4 text-violet-500" />
              Goal
            </span>
            <span className="font-medium text-slate-900">{primaryGoal?.name ?? 'Not set'}</span>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white px-3 py-2.5 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Variants</span>
              <span className="font-semibold text-violet-600">{variants.length}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {variants.map((variant, index) => {
                const weight = Number.isFinite(variant.weight) ? (variant.weight as number) : 0;
                const percent = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                const color = variant.color ?? ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'][index % 5];
                return (
                  <div
                    key={variant.id || `${variant.label}_${index}`}
                    className="flex-1 rounded-full bg-slate-100"
                    title={`${variant.label || 'Variant'} • ${percent}%`}
                  >
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max(8, percent)}%`, backgroundColor: color }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 space-y-1.5">
              {variants.map((variant, index) => {
                const weight = Number.isFinite(variant.weight) ? (variant.weight as number) : 0;
                const percent = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                const color = variant.color ?? ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'][index % 5];
                return (
                  <div key={variant.id || `${variant.label}_${index}`} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-slate-900 truncate">{variant.label || `Variant ${index + 1}`}</span>
                    </div>
                    <span className="font-bold text-slate-700 flex-shrink-0 ml-2">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {sampleResult ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5 text-violet-800">
              <span className="block text-xs font-medium uppercase tracking-wide mb-1">Users / Variant</span>
              <span className="text-base font-bold text-violet-900">
                {sampleResult.usersPerVariant.toLocaleString()}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700">
              <span className="block text-xs font-medium uppercase tracking-wide mb-1">Estimated Days</span>
              <span className="text-base font-bold text-slate-900">
                {sampleResult.estimatedDays ?? '—'}
              </span>
            </div>
          </div>
        ) : null}

        {winner ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
            <Trophy className="h-4 w-4" />
            Winner: <span className="font-bold text-amber-900">{winner.name}</span>
          </div>
        ) : null}
      </div>
    </NodeShell>
  );
});

export const journeyNodeTypes = {
  trigger: BaseNode,
  action: BaseNode,
  goal: BaseNode,
  wait: WaitNode,
  decision: DecisionNode,
  experiment: ExperimentNode,
};


