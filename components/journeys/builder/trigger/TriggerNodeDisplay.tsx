'use client';

import {
  CreditCard,
  Link2,
  MessageCircle,
  Package,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { getEnhancedEventById } from '@/constants/shopifyEvents';
import type { EnhancedUnifiedTriggerConfig } from '@/lib/types/trigger-config';
import type { JourneyNodeData } from '../nodes';

interface TriggerNodeDisplayProps {
  data: JourneyNodeData;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

/* ── Category → icon + colour mapping ── */

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  product: ShoppingBag,
  order: Package,
  cart: ShoppingCart,
  customer: Users,
  payment: CreditCard,
  fulfillment: Truck,
  engagement: MessageCircle,
  marketing: Link2,
};

const CATEGORY_COLOR_MAP: Record<string, { bg: string; text: string; chip: string }> = {
  product: { bg: 'bg-blue-50', text: 'text-blue-600', chip: 'bg-blue-100 text-blue-700' },
  order: { bg: 'bg-amber-50', text: 'text-amber-600', chip: 'bg-amber-100 text-amber-700' },
  cart: { bg: 'bg-orange-50', text: 'text-orange-600', chip: 'bg-orange-100 text-orange-700' },
  customer: { bg: 'bg-purple-50', text: 'text-purple-600', chip: 'bg-purple-100 text-purple-700' },
  payment: { bg: 'bg-emerald-50', text: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
  fulfillment: { bg: 'bg-cyan-50', text: 'text-cyan-600', chip: 'bg-cyan-100 text-cyan-700' },
  engagement: { bg: 'bg-pink-50', text: 'text-pink-600', chip: 'bg-pink-100 text-pink-700' },
  marketing: { bg: 'bg-indigo-50', text: 'text-indigo-600', chip: 'bg-indigo-100 text-indigo-700' },
};

const DEFAULT_COLORS = { bg: 'bg-emerald-50', text: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700' };

/* ── Helpers ── */

const formatTimeframe = (period?: string, customDays?: number): string | undefined => {
  switch (period) {
    case 'last_24_hours':
      return 'Last 24 h';
    case 'last_7_days':
      return 'Last 7 d';
    case 'last_30_days':
      return 'Last 30 d';
    case 'last_90_days':
      return 'Last 90 d';
    case 'custom':
      return customDays ? `Last ${customDays} d` : 'Custom';
    default:
      return undefined;
  }
};

const StatusBadge = ({ status }: { status: 'draft' | 'active' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
        : 'border-slate-200 bg-slate-50 text-slate-500'
    }`}
  >
    <span
      className={`inline-flex h-1.5 w-1.5 rounded-full ${
        status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
      }`}
    />
    {status === 'active' ? 'Active' : 'Draft'}
  </span>
);

/**
 * Summarises the trigger configuration inside the canvas node card.
 * Shows a category-specific icon + colour derived from the selected event.
 */
export function TriggerNodeDisplay({ data }: TriggerNodeDisplayProps) {
  const config = data.triggerConfig as EnhancedUnifiedTriggerConfig | undefined;
  const cleverTap = config?.cleverTapStyle;
  const status = (data.status as 'draft' | 'active' | undefined) ?? 'draft';

  const primaryRule =
    cleverTap?.targetSegment.rules[0] ?? cleverTap?.targetSegment.ruleGroups[0]?.rules[0];
  const eventName = primaryRule?.eventDisplayName ?? primaryRule?.eventName;
  const timeframe = formatTimeframe(primaryRule?.timeFrame?.period, primaryRule?.timeFrame?.customDays);
  const filtersCount = primaryRule?.conditions?.length ?? 0;
  const estimatedCount =
    cleverTap?.estimatedUserCount ??
    (typeof data.meta?.estimatedUserCount === 'number' ? data.meta.estimatedUserCount : undefined);

  const rules = cleverTap?.targetSegment.rules ?? [];
  const ruleGroups = cleverTap?.targetSegment.ruleGroups ?? [];
  const totalRuleCount =
    rules.length + ruleGroups.reduce((acc, g) => acc + g.rules.length, 0);
  const totalFilterCount =
    rules.reduce((a, r) => a + r.conditions.length, 0) +
    ruleGroups.reduce((a, g) => a + g.rules.reduce((s, r) => s + r.conditions.length, 0), 0);

  /* Resolve category from event name */
  const resolvedEvent = eventName ? getEnhancedEventById(eventName) : undefined;
  const category = resolvedEvent?.category;
  const CategoryIcon = category ? (CATEGORY_ICON_MAP[category] ?? Zap) : Zap;
  const colors = category ? (CATEGORY_COLOR_MAP[category] ?? DEFAULT_COLORS) : DEFAULT_COLORS;

  return (
    <div className="group relative flex flex-col gap-2 p-1">
      {/* Header row: icon + name + status */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}
        >
          <CategoryIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {cleverTap?.name?.trim() || data.label || 'Trigger'}
          </div>
          {eventName ? (
            <div className="truncate text-xs text-slate-600">{resolvedEvent?.label ?? eventName}</div>
          ) : (
            <div className="text-xs italic text-slate-400">Select an event</div>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Category chip + timeframe */}
      {(category || timeframe) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {category ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colors.chip}`}>
              {category}
            </span>
          ) : null}
          {timeframe ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {timeframe}
            </span>
          ) : null}
          {filtersCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {filtersCount} filter{filtersCount !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      )}

      {/* Empty-state prompt when no event is configured */}
      {!eventName && !category && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-[11px] italic text-slate-400">
          Click to configure trigger
        </div>
      )}

      {/* Rule / filter / user count pills */}
      {(totalRuleCount > 0 || totalFilterCount > 0 || estimatedCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {totalRuleCount > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
              <span className="font-semibold">{totalRuleCount}</span>
              <span>rule{totalRuleCount !== 1 ? 's' : ''}</span>
            </div>
          ) : null}
          {totalFilterCount > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
              <span className="font-semibold">{totalFilterCount}</span>
              <span>filter{totalFilterCount !== 1 ? 's' : ''}</span>
            </div>
          ) : null}
          {estimatedCount !== undefined ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              <span className="font-semibold">{'\u2248'}{Math.max(estimatedCount, 0).toLocaleString()}</span>
              <span>users</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
