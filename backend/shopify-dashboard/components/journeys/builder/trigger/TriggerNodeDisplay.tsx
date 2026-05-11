'use client';

import { Zap, Edit2, Copy } from 'lucide-react';

import type { EnhancedUnifiedTriggerConfig } from '@/lib/types/trigger-config';
import type { JourneyNodeData } from '../nodes';

interface TriggerNodeDisplayProps {
  data: JourneyNodeData;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

const formatTimeframe = (period?: string, customDays?: number): string | undefined => {
  switch (period) {
    case 'last_24_hours':
      return 'Last 24 hours';
    case 'last_7_days':
      return 'Last 7 days';
    case 'last_30_days':
      return 'Last 30 days';
    case 'last_90_days':
      return 'Last 90 days';
    case 'custom':
      return customDays ? `Last ${customDays} days` : 'Custom window';
    default:
      return undefined;
  }
};

const StatusBadge = ({ status }: { status: 'draft' | 'active' }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
      status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
        : 'border-slate-200 bg-slate-50 text-slate-600'
    }`}
  >
    <span
      className={`inline-flex h-2 w-2 rounded-full ${
        status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
      }`}
    />
    {status === 'active' ? 'Active' : 'Draft'}
  </span>
);

/**
 * Summarises the trigger configuration inside the canvas node card (event, timeframe, filters, status).
 */
export function TriggerNodeDisplay({ data, onEdit, onDuplicate }: TriggerNodeDisplayProps) {
  const config = data.triggerConfig as EnhancedUnifiedTriggerConfig | undefined;
  const cleverTap = config?.cleverTapStyle;
  const status = (data.status as 'draft' | 'active' | undefined) ?? 'draft';
  const primaryRule =
    cleverTap?.targetSegment.rules[0] ?? cleverTap?.targetSegment.ruleGroups[0]?.rules[0];
  const eventName = primaryRule?.eventDisplayName ?? primaryRule?.eventName;
  const timeframe = formatTimeframe(primaryRule?.timeFrame?.period, primaryRule?.timeFrame?.customDays);
  const filtersCount = primaryRule?.conditions?.length ?? 0;
  const estimatedCount =
    cleverTap?.estimatedUserCount ?? (typeof data.meta?.estimatedUserCount === 'number' ? data.meta.estimatedUserCount : undefined);
  const rules = cleverTap?.targetSegment.rules ?? [];
  const ruleGroups = cleverTap?.targetSegment.ruleGroups ?? [];
  const ruleCount = rules.length;
  const groupRuleCount = ruleGroups.reduce((acc, group) => acc + group.rules.length, 0);
  const totalRuleCount = ruleCount + groupRuleCount;
  const ruleFiltersSum = rules.reduce((acc, rule) => acc + rule.conditions.length, 0);
  const groupFiltersSum = ruleGroups.reduce(
    (acc, group) => acc + group.rules.reduce((sum, rule) => sum + rule.conditions.length, 0),
    0,
  );
  const totalFilterCount = ruleFiltersSum + groupFiltersSum;

  return (
    <div className="group relative flex min-w-[220px] flex-col gap-3 rounded-2xl border-2 border-[#8B7DD6]/70 bg-white p-4 shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl">
      {(onEdit || onDuplicate) ? (
        <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {onEdit ? (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onEdit();
              }}
              className="rounded border border-gray-200 bg-white p-1.5 text-gray-600 shadow-sm hover:bg-gray-50"
              title="Edit trigger"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDuplicate ? (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onDuplicate();
              }}
              className="rounded border border-gray-200 bg-white p-1.5 text-gray-600 shadow-sm hover:bg-gray-50"
              title="Duplicate trigger"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B7DD6]/15 text-[#6B58C4]">
          <Zap className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">
            {cleverTap?.name?.trim() || data.label || 'Trigger'}
          </div>
          {eventName ? <div className="text-xs text-slate-500">{eventName}</div> : <div className="text-xs italic text-slate-400">Select an event to get started</div>}
        </div>
        <StatusBadge status={status} />
      </div>

      {timeframe || filtersCount > 0 ? (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {timeframe ? <div>{timeframe}</div> : null}
          {filtersCount > 0 ? (
            <div>{filtersCount} filter{filtersCount === 1 ? '' : 's'} applied</div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400 italic">
          Click to configure trigger details
        </div>
      )}

      {(totalRuleCount > 0 || totalFilterCount > 0 || estimatedCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {totalRuleCount > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
              <span className="font-semibold">{totalRuleCount}</span>
              <span>rule{totalRuleCount !== 1 ? 's' : ''}</span>
            </div>
          ) : null}
          {totalFilterCount > 0 ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-purple-700">
              <span className="font-semibold">{totalFilterCount}</span>
              <span>filter{totalFilterCount !== 1 ? 's' : ''}</span>
            </div>
          ) : null}
          {estimatedCount !== undefined ? (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
              <span className="font-semibold">≈{Math.max(estimatedCount, 0).toLocaleString()}</span>
              <span>users</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

