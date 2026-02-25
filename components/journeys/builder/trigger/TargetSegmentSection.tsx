'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Users, ChevronDown, ChevronUp, Plus, Trash2, Edit } from 'lucide-react';

import type {
  CleverTapStyleRule,
  CleverTapStyleRuleGroup,
  CleverTapStyleTargetSegment,
} from '@/lib/types/trigger-config';
import { cn } from '@/lib/utils';

export interface RuleLocationMain {
  type: 'main';
  index: number;
}

interface RuleLocationGroup {
  type: 'group';
  groupId: string;
  index: number;
}

export type RuleLocation = RuleLocationMain | RuleLocationGroup;

export interface TargetSegmentSectionProps {
  segment: CleverTapStyleTargetSegment;
  onSegmentTypeChange: (type: CleverTapStyleTargetSegment['type']) => void;
  onAddRule: (location: RuleLocationMain) => void;
  onAddRuleGroup: () => void;
  onAddRuleToGroup: (groupId: string) => void;
  onRemoveRule: (ruleId: string, location: RuleLocation) => void;
  onRemoveGroup: (groupId: string) => void;
  onEditRule: (ruleId: string, location: RuleLocation) => void;
  onRenameGroup?: (groupId: string) => void;
  onToggleCollapsed?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
  forceExpanded?: boolean;
  editingRuleRef?: { ruleId: string; location: RuleLocation } | null;
  expandedGroupId?: string | null;
  highlightMain?: boolean;
  renderInlineEditor?: (context: { rule: CleverTapStyleRule; location: RuleLocation }) => React.ReactNode;
  advancedPanel?: React.ReactNode;
}

const formatRuleSummary = (rule: CleverTapStyleRule): string => {
  const eventLabel = rule.eventDisplayName ?? rule.eventName ?? 'Event';
  const timeframe = rule.timeFrame
    ? rule.timeFrame.period === 'custom' && rule.timeFrame.customDays
      ? `Last ${rule.timeFrame.customDays} days`
      : rule.timeFrame.period.replace(/_/g, ' ')
    : 'Any time';
  const filters = rule.conditions.length ? `${rule.conditions.length} filter${rule.conditions.length === 1 ? '' : 's'}` : 'No filters';
  return `${eventLabel} • ${timeframe} • ${filters}`;
};

/**
 * Collapsible "Who" section for the trigger panel that manages rules, groups, and segment type.
 */
export function TargetSegmentSection({
  segment,
  onSegmentTypeChange,
  onAddRule,
  onAddRuleGroup,
  onAddRuleToGroup,
  onRemoveRule,
  onRemoveGroup,
  onEditRule,
  onRenameGroup,
  onToggleCollapsed,
  defaultCollapsed = false,
  forceExpanded = false,
  editingRuleRef = null,
  expandedGroupId = null,
  highlightMain = false,
  renderInlineEditor = undefined,
  advancedPanel,
}: TargetSegmentSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      onToggleCollapsed?.(next);
      return next;
    });
  };

  useEffect(() => {
    if (forceExpanded) {
      setCollapsed(false);
    }
  }, [forceExpanded]);

  const totalRules = useMemo(
    () => segment.rules.length + segment.ruleGroups.reduce((count, group) => count + group.rules.length, 0),
    [segment.rules.length, segment.ruleGroups],
  );

  const renderRuleRow = (rule: CleverTapStyleRule, location: RuleLocation) => {
    const isEditing = editingRuleRef?.ruleId === rule.id;

    return (
      <div key={rule.id} className="space-y-3">
        <div
          className={cn(
            'flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 sm:flex-row sm:items-start sm:justify-between',
            isEditing && 'border-[#8B7DD6] bg-[#EEF2FF] shadow-md shadow-[#C7D2FE]/40',
          )}
        >
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-slate-800">
              {formatRuleSummary(rule)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                {rule.ruleType.replace(/_/g, ' ')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                {rule.subcategory}
              </span>
              {rule.action ? (
                <span className="text-[11px] uppercase tracking-wide text-slate-500">Action: {rule.action}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onEditRule(rule.id, location);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              title="Edit rule"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onRemoveRule(rule.id, location);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              title="Remove rule"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isEditing && renderInlineEditor ? (
          <div className="overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white shadow-lg shadow-black/5">
            {renderInlineEditor({ rule, location })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderGroup = (group: CleverTapStyleRuleGroup) => (
    <div
      key={group.id}
      className={cn(
        'space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-4 transition-all duration-200',
        (expandedGroupId === group.id || (editingRuleRef?.location.type === 'group' && editingRuleRef.location.groupId === group.id)) &&
          'border-violet-300 bg-violet-100/70 shadow-lg shadow-violet-200/60',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#6c5ecf]">Rule group ({group.operator})</div>
          <p className="text-xs text-[#6c5ecf]/70">
            Combine rules with {group.operator === 'AND' ? 'all conditions required' : 'any condition matching'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRenameGroup ? (
            <button
              type="button"
              onClick={() => onRenameGroup(group.id)}
              className="rounded-full border border-violet-200 px-3 py-1 text-xs font-semibold text-[#6c5ecf] transition hover:bg-white"
            >
              Rename
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onAddRuleToGroup(group.id)}
            className="inline-flex items-center gap-2 rounded-full border border-violet-300 px-3 py-1 text-xs font-semibold text-[#6c5ecf] transition hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </button>
          <button
            type="button"
            onClick={() => onRemoveGroup(group.id)}
            className="inline-flex items-center gap-2 rounded-full border border-violet-300 px-3 py-1 text-xs font-semibold text-[#6c5ecf] transition hover:bg-white hover:text-red-600 hover:border-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove group
          </button>
        </div>
      </div>

      <div className="space-y-4 pl-0 sm:pl-2">
        {group.rules.map((rule, index) => renderRuleRow(rule, { type: 'group', groupId: group.id, index }))}
        {group.rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white/60 px-4 py-6 text-center text-xs text-[#6c5ecf]">
            No rules yet. Add a rule to this group.
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-lg border border-[#E8E4DE] bg-white">
      <header
        className="flex cursor-pointer items-center justify-between gap-3 bg-[#F5F3EE] px-4 py-3"
        onClick={handleToggleCollapsed}
        role="button"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#D4A574]/15 text-[#D4A574]">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#4A4139]">Who enters this journey</div>
            <p className="text-[11px] text-[#8B7F76]">{totalRules} rule{totalRules === 1 ? '' : 's'} configured</p>
          </div>
        </div>
        <div className="flex items-center">
          {collapsed ? <ChevronDown className="h-4 w-4 text-[#8B7F76]" /> : <ChevronUp className="h-4 w-4 text-[#8B7F76]" />}
        </div>
      </header>

      {!collapsed ? (
        <div className="space-y-4 px-4 py-4">
          <div
            className={cn(
              'space-y-2',
              highlightMain &&
                'rounded-lg border border-[#D4A574]/40 bg-[#D4A574]/5 p-3',
            )}
          >
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8B7F76]">Target Segment</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1">
                <select
                  className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
                  value={segment.type}
                  onChange={event => onSegmentTypeChange(event.target.value as CleverTapStyleTargetSegment['type'])}
                >
                  <option value="new_segment">Build new segment</option>
                  <option value="existing_segment">Use existing segment</option>
                </select>
              </div>
              <button
                type="button"
                onClick={onAddRuleGroup}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E8E4DE] px-3 py-2 text-xs font-semibold text-[#4A4139] transition hover:bg-[#F5F3EE] sm:w-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                Add group
              </button>
            </div>
          </div>

          {advancedPanel ? <div>{advancedPanel}</div> : null}

          <div className="space-y-2">
            {segment.rules.length === 0 ? null : (
              <div className={cn('space-y-3', segment.rules.length > 0 && 'pt-1')}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8B7F76]">Rules</div>
                {segment.rules.map((rule, index) =>
                  renderRuleRow(rule, {
                    type: 'main',
                    index,
                  }),
                )}
              </div>
            )}

            {segment.ruleGroups.map(group => renderGroup(group))}

            {segment.rules.length === 0 && segment.ruleGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E8E4DE] bg-[#F5F3EE]/50 px-4 py-6 text-center text-xs text-[#8B7F76] space-y-2">
                <p className="font-medium text-[#4A4139]">No rules configured yet</p>
                <p>Add your first rule to define who should enter this journey.</p>
                <button
                  type="button"
                  onClick={() => onAddRule({ type: 'main', index: 0 })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A574] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#B8835D]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add first rule
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAddRule({ type: 'main', index: segment.rules.length })}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#D4A574] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#B8835D] sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </button>
            <span className="text-[11px] text-[#8B7F76]">
              Rules combine with <strong>AND</strong>.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

