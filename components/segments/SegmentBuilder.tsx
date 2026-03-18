'use client';

import { useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import ConditionRow, { ConditionValue } from './ConditionRow';
import { EventRuleRow, type EventRule } from './EventRuleRow';
import { ConditionSummary } from './ConditionSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Eye, Save, Zap, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { CustomerSegment } from '@/lib/types/segment';

type Group = {
  id: string;
  groupOperator: 'AND' | 'OR';
  conditions: ConditionValue[];
};

const createEmptyGroup = (): Group => ({
  id: crypto.randomUUID(),
  groupOperator: 'AND',
  conditions: [],
});

const normalizeGroups = (groups: Group[] | undefined): Group[] =>
  groups && groups.length > 0
    ? groups.map(group => ({
        ...group,
        conditions: group.conditions.map(condition => ({
          ...condition,
          value: condition.value ?? '',
        })),
      }))
    : [createEmptyGroup()];

const createEmptyEventRule = (): EventRule => ({
  id: nanoid(),
  eventName: '',
  eventDisplayName: undefined,
  action: 'did',
  conditions: [],
});

export default function SegmentBuilder({
  initialName = '',
  initialDescription = '',
  initialGroups,
  initialEventRules,
  onSaved,
  segmentId,
}: {
  initialName?: string;
  initialDescription?: string;
  initialGroups?: Group[];
  initialEventRules?: EventRule[];
  onSaved?: (segment: CustomerSegment) => void;
  segmentId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [groups, setGroups] = useState<Group[]>(normalizeGroups(initialGroups));
  const [eventRules, setEventRules] = useState<EventRule[]>(initialEventRules ?? []);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setGroups(normalizeGroups(initialGroups));
    setEventRules(initialEventRules ?? []);
  }, [initialName, initialDescription, initialGroups, initialEventRules]);

  const hasConditions = useMemo(
    () => groups.some(g => g.conditions.length > 0) || eventRules.some(r => r.eventName),
    [groups, eventRules],
  );

  useEffect(() => {
    if (!hasConditions) {
      setPreviewCount(null);
      return;
    }

    setIsPreviewing(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/segments/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conditionGroups: groups, eventRules: eventRules.filter(r => r.eventName), forceRefresh: true }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to preview segment');
        const data = (await res.json()) as { customerCount?: number; count?: number };
        setPreviewCount(data.customerCount ?? data.count ?? 0);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[SegmentBuilder] Preview error:', error);
        setPreviewCount(null);
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
  }, [groups, eventRules, hasConditions]);

  const addGroup = () => setGroups(groups => [...groups, createEmptyGroup()]);
  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(gs => gs.filter(g => g.id !== groupId));
  };
  const addCondition = (groupId: string) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: [...g.conditions, { id: crypto.randomUUID(), field: 'customer_name', operator: 'contains', value: '' }] } : g)));
  const updateCondition = (groupId: string, condId: string, next: ConditionValue) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: g.conditions.map(c => (c.id === condId ? next : c)) } : g)));
  const removeCondition = (groupId: string, condId: string) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: g.conditions.filter(c => c.id !== condId) } : g)));
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

  const addEventRule = () => setEventRules(prev => [...prev, createEmptyEventRule()]);
  const updateEventRule = (ruleId: string, updated: EventRule) =>
    setEventRules(prev => prev.map(r => (r.id === ruleId ? updated : r)));
  const removeEventRule = (ruleId: string) =>
    setEventRules(prev => prev.filter(r => r.id !== ruleId));

  const doSave = async () => {
    setIsSaving(true);
    try {
      const body = { name, description, conditionGroups: groups, eventRules: eventRules.filter(r => r.eventName) };
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
        if (segment) {
          onSaved?.(segment);
        }
      } else if (savedPayload) {
        onSaved?.(savedPayload as CustomerSegment);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Segment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </CardContent>
      </Card>

      {/* Condition Summary */}
      {hasConditions && (
        <ConditionSummary groups={groups} eventRules={eventRules} />
      )}

      {/* Condition Groups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Conditions</CardTitle>
            <Button variant="outline" size="sm" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-1" /> Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.id);

            return (
              <div key={group.id}>
                {/* AND separator between groups */}
                {groupIndex > 0 && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 py-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    AND
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}

                <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroupCollapse(group.id)}>
                  <div className="rounded-lg border bg-white">
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50/50">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          <span className="font-medium">
                            Group {groupIndex + 1}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''})
                          </span>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-gray-500">Match</span>
                        <select
                          value={group.groupOperator}
                          onChange={event => setGroupOp(group.id, event.target.value === 'OR' ? 'OR' : 'AND')}
                          className="px-2 py-1 border rounded text-xs"
                        >
                          <option value="AND">ALL (AND)</option>
                          <option value="OR">ANY (OR)</option>
                        </select>
                        {groups.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeGroup(group.id)}
                            className="h-7 w-7 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="p-4 space-y-3">
                        {group.conditions.length === 0 && (
                          <div className="text-sm text-gray-500 text-center py-4 border border-dashed rounded-lg">
                            No conditions yet. Add a condition to filter customers.
                          </div>
                        )}

                        {group.conditions.map((c) => (
                          <ConditionRow
                            key={c.id}
                            condition={c}
                            onChange={(next) => updateCondition(group.id, c.id, next)}
                            onRemove={() => removeCondition(group.id, c.id)}
                          />
                        ))}

                        <Button variant="outline" size="sm" onClick={() => addCondition(group.id)}>
                          <Plus className="w-4 h-4 mr-1" /> Add condition
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Event Rules Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#D4A574]" />
              <CardTitle>Advanced Event Rules</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={addEventRule}>
              <Plus className="w-4 h-4 mr-1" /> Add Event Rule
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Filter customers based on Shopify events they performed (or did not perform).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventRules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No event rules added. Click &quot;Add Event Rule&quot; to filter by customer events like Product Viewed, Order Created, etc.
            </div>
          ) : (
            eventRules.map((rule, index) => (
              <div key={rule.id}>
                {index > 0 && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 py-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    AND
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}
                <EventRuleRow
                  rule={rule}
                  onChange={(updated) => updateEventRule(rule.id, updated)}
                  onRemove={() => removeEventRule(rule.id)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Preview & Save bar */}
      <div className="flex items-center gap-3 text-sm text-gray-600 sticky bottom-0 bg-white/95 backdrop-blur-sm p-4 border rounded-lg shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          <Eye className={`w-4 h-4 ${isPreviewing ? 'animate-pulse text-blue-500' : 'text-gray-400'}`} />
          {isPreviewing && hasConditions && <span>Calculating preview...</span>}
          {!isPreviewing && hasConditions && previewCount != null && (
            <span><span className="font-semibold text-lg">{previewCount.toLocaleString()}</span> customers match</span>
          )}
          {!isPreviewing && !hasConditions && <span className="text-gray-400">Add conditions to preview matching customers</span>}
        </div>
        <Button onClick={doSave} disabled={!name || isSaving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : segmentId ? 'Update Segment' : 'Save Segment'}
        </Button>
      </div>
    </div>
  );
}
