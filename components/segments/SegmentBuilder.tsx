'use client';

import { useEffect, useMemo, useState } from 'react';
import ConditionRow, { ConditionValue } from './ConditionRow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, Save } from 'lucide-react';
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

export default function SegmentBuilder({
  initialName = '',
  initialDescription = '',
  initialGroups,
  onSaved,
  segmentId,
}: {
  initialName?: string;
  initialDescription?: string;
  initialGroups?: Group[];
  onSaved?: (segment: CustomerSegment) => void;
  segmentId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [groups, setGroups] = useState<Group[]>(normalizeGroups(initialGroups));
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setGroups(normalizeGroups(initialGroups));
  }, [initialName, initialDescription, initialGroups]);

  const hasConditions = useMemo(() => groups.some(g => g.conditions.length > 0), [groups]);

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
          body: JSON.stringify({ conditionGroups: groups, forceRefresh: true }),
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
  }, [groups, hasConditions]);

  const addGroup = () => setGroups(groups => [...groups, createEmptyGroup()]);
  const addCondition = (groupId: string) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: [...g.conditions, { id: crypto.randomUUID(), field: 'customer_name', operator: 'contains', value: '' }] } : g)));
  const updateCondition = (groupId: string, condId: string, next: ConditionValue) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: g.conditions.map(c => (c.id === condId ? next : c)) } : g)));
  const removeCondition = (groupId: string, condId: string) =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, conditions: g.conditions.filter(c => c.id !== condId) } : g)));
  const setGroupOp = (groupId: string, op: 'AND' | 'OR') =>
    setGroups(gs => gs.map(g => (g.id === groupId ? { ...g, groupOperator: op } : g)));

  const doSave = async () => {
    setIsSaving(true);
    try {
      const body = { name, description, conditionGroups: groups };
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

      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Match customers where</div>
                <div className="flex items-center gap-2 text-sm">
                  Combine within group by
                  <select
                    value={group.groupOperator}
                    onChange={event => setGroupOp(group.id, event.target.value === 'OR' ? 'OR' : 'AND')}
                    className="px-2 py-1 border rounded"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
              </div>

              {group.conditions.length === 0 && (
                <div className="text-sm text-gray-500">No conditions yet.</div>
              )}

              {group.conditions.map((c) => (
                <ConditionRow
                  key={c.id}
                  condition={c}
                  onChange={(next) => updateCondition(group.id, c.id, next)}
                  onRemove={() => removeCondition(group.id, c.id)}
                />
              ))}

              <Button variant="outline" onClick={() => addCondition(group.id)}>
                <Plus className="w-4 h-4 mr-2" /> Add condition
              </Button>
            </div>
          ))}

          <div>
            <Button variant="outline" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-2" /> Add group
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Eye className={`w-4 h-4 ${isPreviewing ? 'animate-pulse text-blue-500' : 'text-gray-400'}`} />
          {isPreviewing && hasConditions && <span>Calculating preview…</span>}
          {!isPreviewing && hasConditions && previewCount != null && (
            <span><span className="font-semibold">{previewCount.toLocaleString()}</span> customers match these conditions</span>
          )}
          {!isPreviewing && !hasConditions && <span>Add conditions to preview matching customers</span>}
        </div>
        <Button onClick={doSave} disabled={!name || isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving…' : 'Save segment'}
        </Button>
      </div>
    </div>
  );
}


