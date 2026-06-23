'use client';

import { useEffect, useMemo, useState } from 'react';
import ConditionRow, { ConditionValue } from './ConditionRow';
import { ConditionSummary } from './ConditionSummary';
import { SegmentFieldsProvider } from './segment-fields-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, Save, ChevronDown, ChevronRight, Trash2,
  Users, TrendingUp, Loader2, User,
} from 'lucide-react';
import type { CustomerSegment } from '@/lib/types/segment';

export type Group = {
  id: string;
  groupOperator: 'AND' | 'OR';
  conditions: ConditionValue[];
};

type GroupInput = {
  id: string;
  groupOperator: 'AND' | 'OR';
  conditions: ConditionValue[];
};

type PreviewData = {
  customerCount?: number;
  count?: number;
  totalValue?: number;
  avgOrderValue?: number;
  averageOrderValue?: number;
  error?: string;
  sampleCustomers?: Array<{ name?: string; email?: string; phone?: string }>;
};

const createEmptyGroup = (): Group => ({
  id: crypto.randomUUID(),
  groupOperator: 'AND',
  conditions: [],
});

const normalizeGroups = (groups: GroupInput[] | undefined): Group[] =>
  groups && groups.length > 0
    ? groups.map(group => ({
        id: group.id,
        groupOperator: group.groupOperator,
        conditions: group.conditions.map(condition => ({
          ...condition,
          value: condition.value ?? '',
        })),
      }))
    : [createEmptyGroup()];

// Operators that don't require a value to be meaningful
const NO_VALUE_OPERATORS = new Set([
  'is_empty', 'is_not_empty', 'is_true', 'is_false',
]);

/** A condition counts toward the live preview only once it has a usable value. */
const isConditionReady = (c: ConditionValue): boolean => {
  if (NO_VALUE_OPERATORS.has(c.operator)) return true;
  const v = c.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true; // numbers, etc.
};

export default function SegmentBuilder({
  initialName = '',
  initialDescription = '',
  initialGroups,
  onSaved,
  segmentId,
}: {
  initialName?: string;
  initialDescription?: string;
  initialGroups?: GroupInput[];
  onSaved?: (segment: CustomerSegment) => void;
  segmentId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [groups, setGroups] = useState<Group[]>(() => normalizeGroups(initialGroups));
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setGroups(normalizeGroups(initialGroups));
  }, [initialName, initialDescription, initialGroups]);

  // Only groups/conditions that are actually ready drive the preview.
  const readyGroups = useMemo(
    () =>
      groups
        .map(g => ({ ...g, conditions: g.conditions.filter(isConditionReady) }))
        .filter(g => g.conditions.length > 0),
    [groups],
  );

  const hasConditions = useMemo(
    () => readyGroups.length > 0,
    [readyGroups],
  );

  // Live preview with debounce
  useEffect(() => {
    if (!hasConditions) {
      setPreviewData(null);
      return;
    }

    setIsPreviewing(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/segments/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditionGroups: readyGroups,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to preview segment');
        const data = (await res.json()) as PreviewData;
        setPreviewData(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[SegmentBuilder] Preview error:', error);
        setPreviewData(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewing(false);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [readyGroups, hasConditions]);

  // Group actions
  const addGroup = () => setGroups(gs => [...gs, createEmptyGroup()]);
  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(gs => gs.filter(g => g.id !== groupId));
  };
  const setGroupOp = (groupId: string, op: 'AND' | 'OR') =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, groupOperator: op } : g)));
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Condition actions
  const addCondition = (groupId: string) =>
    setGroups(gs =>
      gs.map(g =>
        g.id === groupId
          ? {
              ...g,
              conditions: [
                ...g.conditions,
                {
                  id: crypto.randomUUID(),
                  field: 'customer_name',
                  operator: 'contains',
                  value: '',
                },
              ],
            }
          : g,
      ),
    );
  const updateCondition = (groupId: string, condId: string, next: ConditionValue) =>
    setGroups(gs =>
      gs.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.map(c => (c.id === condId ? next : c)) }
          : g,
      ),
    );
  const removeCondition = (groupId: string, condId: string) =>
    setGroups(gs =>
      gs.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter(c => c.id !== condId) }
          : g,
      ),
    );

  // Save
  const doSave = async () => {
    setIsSaving(true);
    try {
      const body = {
        name,
        description,
        conditionGroups: groups,
      };
      const res = await fetch(segmentId ? `/api/segments/${segmentId}` : '/api/segments', {
        method: segmentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || 'Failed to save segment');
      }
      const savedPayload = (await res.json()) as unknown;
      if (savedPayload && typeof savedPayload === 'object' && 'segment' in savedPayload) {
        const segment = (savedPayload as { segment?: CustomerSegment }).segment;
        if (segment) onSaved?.(segment);
      } else if (savedPayload) {
        onSaved?.(savedPayload as CustomerSegment);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const previewCount = previewData?.customerCount ?? previewData?.count ?? null;

  return (
    <SegmentFieldsProvider>
    <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
      {/* ─── Left Column: Builder ─── */}
      <div className="w-full lg:flex-1 min-w-0 space-y-5">
        {/* Segment Details */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Segment Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., High-value customers in Mumbai"
                className="text-base font-medium h-11"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe who this segment targets (optional)"
              />
            </div>
          </CardContent>
        </Card>

        {/* Condition Summary */}
        {hasConditions && <ConditionSummary groups={groups} />}

        {/* Unified Filter Builder */}
        <div className="space-y-4">
          {groups.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.id);
            const condCount = group.conditions.length;

            return (
              <div key={group.id}>
                {/* AND separator between groups */}
                {groupIndex > 0 && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="h-px flex-1 bg-primary/20" />
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">AND</span>
                    <div className="h-px flex-1 bg-primary/20" />
                  </div>
                )}

                <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroupCollapse(group.id)}>
                  <Card className="border-border overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          <span className="font-semibold">Group {groupIndex + 1}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {condCount === 0
                              ? '(empty)'
                              : `${condCount} condition${condCount !== 1 ? 's' : ''}`}
                          </span>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-muted-foreground hidden sm:inline">Match</span>
                        <select
                          value={group.groupOperator}
                          onChange={e =>
                            setGroupOp(group.id, e.target.value === 'OR' ? 'OR' : 'AND')
                          }
                          className="px-2 py-1.5 border border-border rounded-md text-xs bg-card text-foreground font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <option value="AND">ALL (AND)</option>
                          <option value="OR">ANY (OR)</option>
                        </select>
                        {groups.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeGroup(group.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <CollapsibleContent>
                      <CardContent className="p-4 space-y-3">
                        {/* Empty state */}
                        {condCount === 0 && (
                          <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/10">
                            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No conditions yet. Add one below — customer traits,
                              order history, Shopify events and more.
                            </p>
                          </div>
                        )}

                        {/* Condition rows */}
                        {group.conditions.map((c, cIndex) => (
                          <div key={c.id}>
                            {cIndex > 0 && (
                              <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground py-1.5">
                                <div className="h-px flex-1 bg-border" />
                                {group.groupOperator}
                                <div className="h-px flex-1 bg-border" />
                              </div>
                            )}
                            <ConditionRow
                              condition={c}
                              onChange={next => updateCondition(group.id, c.id, next)}
                              onRemove={() => removeCondition(group.id, c.id)}
                            />
                          </div>
                        ))}

                        {/* Action button */}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addCondition(group.id)}
                            className="text-xs h-9"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Add Condition
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            );
          })}

          {/* Add Group button */}
          <Button variant="outline" size="sm" onClick={addGroup} className="w-full h-10 border-dashed border-2">
            <Plus className="w-4 h-4 mr-1.5" /> Add Another Group
          </Button>
        </div>
      </div>

      {/* ─── Right Column: Live Preview Panel ─── */}
      <div className="w-80 shrink-0 hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <Card className="border-primary/10 overflow-hidden">
            {/* Preview header */}
            <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Live Preview
              </h3>
            </div>

            <CardContent className="p-4 space-y-4">
              {/* Customer count */}
              <div className="text-center py-3">
                {isPreviewing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Calculating...</span>
                  </div>
                ) : hasConditions && previewData?.error ? (
                  <div className="py-2">
                    <Users className="w-8 h-8 text-amber-500/40 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      {/rate limit/i.test(previewData.error) ? 'Shopify is busy' : 'Preview unavailable'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {/rate limit/i.test(previewData.error)
                        ? 'Shopify is rate-limiting requests. Try again in a moment.'
                        : /credential|reconfigure|invalid/i.test(previewData.error)
                          ? 'Reconnect your store in Settings to preview matching customers.'
                          : previewData.error}
                    </p>
                  </div>
                ) : hasConditions && previewCount != null ? (
                  <>
                    <p className="text-4xl font-bold text-foreground">
                      {previewCount.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">customers match</p>
                  </>
                ) : (
                  <div className="py-2">
                    <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Add filters to preview matching customers
                    </p>
                  </div>
                )}
              </div>

              {/* Quick stats */}
              {hasConditions && previewData && !previewData.error && !isPreviewing && (
                <>
                  <div className="h-px bg-border" />
                  <div className="grid grid-cols-2 gap-3">
                    {previewData.totalValue != null && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <TrendingUp className="w-3 h-3" />
                          Revenue
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            maximumFractionDigits: 0,
                          }).format(previewData.totalValue)}
                        </p>
                      </div>
                    )}
                    {(previewData.avgOrderValue ?? previewData.averageOrderValue) != null && (
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <TrendingUp className="w-3 h-3" />
                          Avg Order
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            maximumFractionDigits: 0,
                          }).format((previewData.avgOrderValue ?? previewData.averageOrderValue) as number)}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Sample customers */}
              {hasConditions &&
                previewData?.sampleCustomers &&
                previewData.sampleCustomers.length > 0 &&
                !isPreviewing && (
                  <>
                    <div className="h-px bg-border" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Sample Customers
                      </p>
                      <div className="space-y-2">
                        {previewData.sampleCustomers.slice(0, 5).map((customer, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-foreground truncate text-xs font-medium">
                                {customer.name || 'Unknown'}
                              </p>
                              <p className="text-muted-foreground truncate text-[10px]">
                                {customer.email || customer.phone || ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </CardContent>

            {/* Save button */}
            <div className="px-4 pb-4">
              <Button
                onClick={doSave}
                disabled={!name || isSaving}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : segmentId ? 'Update Segment' : 'Save Segment'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Mobile: Sticky bottom bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-card/95 backdrop-blur-sm border-t border-border px-4 py-3 z-50">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Users className={`w-4 h-4 ${isPreviewing ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            {isPreviewing && hasConditions && (
              <span className="text-sm text-muted-foreground">Calculating...</span>
            )}
            {!isPreviewing && hasConditions && previewCount != null && (
              <span className="text-sm">
                <span className="font-semibold text-foreground">{previewCount.toLocaleString()}</span>
                <span className="text-muted-foreground"> customers</span>
              </span>
            )}
            {!isPreviewing && !hasConditions && (
              <span className="text-sm text-muted-foreground">Add filters to preview</span>
            )}
          </div>
          <Button
            onClick={doSave}
            disabled={!name || isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
    </SegmentFieldsProvider>
  );
}
