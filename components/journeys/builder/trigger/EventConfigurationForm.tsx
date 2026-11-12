'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { nanoid } from 'nanoid';

import { EventSelector } from './EventSelector';
import { PropertyConditionRow } from './PropertyConditionRow';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CleverTapStyleRule, EventCondition } from '@/lib/types/trigger-config';
import type { EnhancedShopifyEvent, ShopifyEventProperty } from '@/constants/shopifyEvents';
import { getEnhancedEventById } from '@/constants/shopifyEvents';
import { useToast } from '@/lib/hooks/useToast';
import { useTenant } from '@/lib/tenant/tenant-context';
import type { EventSource } from '@/lib/types/event-source';
import type { JourneyEventSchema } from '@/lib/journeys/event-schema';

interface EventConfigurationFormProps {
  rule: CleverTapStyleRule;
  onSave: (updated: CleverTapStyleRule) => void;
  onCancel: () => void;
}

export function EventConfigurationForm({ rule, onSave, onCancel }: EventConfigurationFormProps) {
  const toast = useToast();
  const { currentStore } = useTenant();
  const [localRule, setLocalRule] = useState<CleverTapStyleRule>(() => {
    const liveRule = { ...rule };
    delete liveRule.timeFrame;
    return liveRule;
  });
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(rule.eventName ?? undefined);
  const [customEventsCache, setCustomEventsCache] = useState<EnhancedShopifyEvent[]>([]);
  const [registeredSchema, setRegisteredSchema] = useState<JourneyEventSchema | null>(null);

  // Fetch custom events so we can resolve custom event IDs
  useEffect(() => {
    if (!currentStore?.id) return;
    fetch('/api/settings/custom-events', {
      headers: { 'x-store-id': currentStore.id },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.events)) {
          setCustomEventsCache(
            data.events
              .filter((e: { isActive: boolean }) => e.isActive)
              .map((e: { eventName: string; displayName: string; description?: string; properties?: Array<{ name: string; type: string; description?: string }>; sources?: EventSource[] }) => ({
                id: `custom:${e.eventName}`,
                label: e.displayName,
                description: e.description || `Custom event: ${e.displayName}`,
                category: 'custom' as EnhancedShopifyEvent['category'],
                sources: e.sources || [],
                properties: (e.properties || []).map((p: { name: string; type: string; description?: string }) => ({
                  name: p.name,
                  type: (p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : p.type === 'date' ? 'date' : 'string') as 'string' | 'number' | 'boolean' | 'date',
                  description: p.description || p.name,
                })),
              }))
          );
        }
      })
      .catch(() => {});
  }, [currentStore?.id]);

  useEffect(() => {
    if (!selectedEventId || !currentStore?.id) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/journeys/event-schema?event=${encodeURIComponent(selectedEventId)}`, {
      headers: { 'x-store-id': currentStore.id },
      signal: controller.signal,
    })
      .then(async response => response.ok ? response.json() : null)
      .then(result => setRegisteredSchema(result?.schema ?? null))
      .catch(error => {
        if (error?.name !== 'AbortError') setRegisteredSchema(null);
      });
    return () => controller.abort();
  }, [currentStore?.id, selectedEventId]);

  const selectedEvent = useMemo<EnhancedShopifyEvent | undefined>(() => {
    if (!selectedEventId) return undefined;
    // First try built-in events
    const builtIn = getEnhancedEventById(selectedEventId);
    if (builtIn) return builtIn;
    // Then check custom events
    return customEventsCache.find(e => e.id === selectedEventId);
  }, [selectedEventId, customEventsCache]);
  const availableProperties = useMemo<ShopifyEventProperty[]>(() => {
    const schema = registeredSchema;
    if (schema && schema.id === selectedEventId) {
      return schema.fields.map(field => ({
        name: field.path,
        type: field.type === 'number' || field.type === 'currency'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : 'string',
        description: `${field.label}${field.description ? ` — ${field.description}` : ''}`,
      }));
    }
    return selectedEvent?.properties ?? [];
  }, [registeredSchema, selectedEvent, selectedEventId]);

  const handleEventSelect = (event: EnhancedShopifyEvent) => {
    setSelectedEventId(event.id);
    setLocalRule(prev => ({
      ...prev,
      eventName: event.id,
      eventDisplayName: event.label,
      conditions: [],
    }));
  };

  const handleActionChange = (action: CleverTapStyleRule['action']) => {
    setLocalRule(prev => ({
      ...prev,
      action,
    }));
  };

  const handleAddCondition = () => {
    if (!selectedEvent) {
      toast.error('Select an event before adding filters');
      return;
    }
    if (!availableProperties.length) {
      toast.warning('This event has no properties available yet');
      return;
    }
    const newCondition: EventCondition = {
      id: nanoid(),
      property: availableProperties[0].name,
      operator: 'equals',
      value: '',
    };
    setLocalRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
  };

  const handleConditionUpdate = (conditionId: string, updates: Partial<EventCondition>) => {
    setLocalRule(prev => ({
      ...prev,
      conditions: prev.conditions.map(condition => (condition.id === conditionId ? { ...condition, ...updates } : condition)),
    }));
  };

  const handleConditionRemove = (conditionId: string) => {
    setLocalRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter(condition => condition.id !== conditionId),
    }));
  };

  const handleSubmit = () => {
    if (!localRule.eventName) {
      toast.error('Please select an event');
      return;
    }
    const ruleToSave = { ...localRule };
    delete ruleToSave.timeFrame;
    onSave(ruleToSave);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white shadow-lg shadow-black/5">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E8E4DE] px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#8B7DD6] hover:text-[#6F5CD6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rules
        </button>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.3em] text-[#B8977F]">Configure event</p>
          <p className="text-lg font-semibold text-[#4A4139]">{selectedEvent?.label ?? 'Select an event'}</p>
        </div>
      </div>

      <div className="custom-scroll flex-1 overflow-y-auto px-6 py-4 space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-semibold text-[#4A4139]">
            Event <span className="text-red-500">*</span>
          </label>
          <EventSelector
            selectedEventId={selectedEventId}
            onSelectEvent={handleEventSelect}
            placeholder="Choose a Shopify event"
          />
          {selectedEvent ? (
            <p className="text-xs text-[#8B7F76]">
              Event has {selectedEvent.properties?.length ?? 0} properties available for filtering.
            </p>
          ) : (
            <p className="text-xs text-[#8B7F76]">Select an event to configure actions and filters.</p>
          )}
        </div>

        {selectedEvent ? (
          <>
            {/* Event rules run only for newly received events. */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#4A4139]">
                Action <span className="text-red-500">*</span>
              </label>
              <Select value={localRule.action ?? 'did'} onValueChange={value => handleActionChange(value as CleverTapStyleRule['action'])}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="did">Did</SelectItem>
                  <SelectItem value="did_not">Did Not</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-emerald-700">Live event: this rule evaluates each new event as it arrives. Historical events are not replayed.</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-[#F5F3EE]/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#4A4139]">Filters (optional)</p>
                  <p className="text-xs text-[#8B7F76]">Add event property conditions to narrow the audience.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCondition}
                  disabled={!availableProperties.length}
                  className="border-[#8B7DD6] text-[#8B7DD6] hover:bg-[#8B7DD6]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add filter
                </Button>
              </div>

              {!availableProperties.length ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  ⚠️ This event has no properties that can be filtered yet.
                </div>
              ) : null}

              {localRule.conditions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5F5] bg-white p-6 text-center">
                  <p className="text-sm text-[#4A5568]">No filters added yet.</p>
                  <p className="text-xs text-[#718096]">Use the button above to add your first filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {localRule.conditions.map((condition, index) => (
                    <div key={condition.id} className="space-y-2">
                      {index > 0 ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8B7F76]">
                          <div className="h-px flex-1 bg-[#E8E4DE]" />
                          AND
                          <div className="h-px flex-1 bg-[#E8E4DE]" />
                        </div>
                      ) : null}
                      <PropertyConditionRow
                        condition={condition}
                        availableProperties={availableProperties}
                        onUpdate={updates => handleConditionUpdate(condition.id, updates)}
                        onRemove={() => handleConditionRemove(condition.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#E8E4DE] px-6 py-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!localRule.eventName}>
          Save rule
        </Button>
      </div>
    </div>
  );
}

