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
    <div className="group relative flex flex-col gap-2.5 p-1">
      {/* Edit/Duplicate buttons are handled by NodeShell header */}

      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Zap className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {cleverTap?.name?.trim() || data.label || 'Trigger'}
          </div>
          {eventName ? <div className="truncate text-xs text-slate-600">{eventName}</div> : <div className="text-xs italic text-slate-400">Select an event</div>}
        </div>
        <StatusBadge status={status} />
      </div>

      {timeframe || filtersCount > 0 ? (
        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          {timeframe ? <div>{timeframe}</div> : null}
          {filtersCount > 0 ? (
            <div>{filtersCount} filter{filtersCount === 1 ? '' : 's'} applied</div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-[11px] text-slate-400 italic">
          Click to configure trigger
        </div>
      )}

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
              <span className="font-semibold">≈{Math.max(estimatedCount, 0).toLocaleString()}</span>
              <span>users</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

