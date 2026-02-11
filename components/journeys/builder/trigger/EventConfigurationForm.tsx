'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { nanoid } from 'nanoid';

import { EventSelector } from './EventSelector';
import { PropertyConditionRow } from './PropertyConditionRow';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CleverTapStyleRule, EventCondition, TimeFrame } from '@/lib/types/trigger-config';
import type { EnhancedShopifyEvent, ShopifyEventProperty } from '@/constants/shopifyEvents';
import { getEnhancedEventById } from '@/constants/shopifyEvents';
import { useToast } from '@/lib/hooks/useToast';

interface EventConfigurationFormProps {
  rule: CleverTapStyleRule;
  onSave: (updated: CleverTapStyleRule) => void;
  onCancel: () => void;
}

// TimeFrame options removed from UI - kept for default value assignment
// const TIMEFRAME_OPTIONS: Array<{ label: string; value: TimeFrame['period'] }> = [
//   { value: 'last_24_hours', label: 'Last 24 hours' },
//   { value: 'last_7_days', label: 'Last 7 days' },
//   { value: 'last_30_days', label: 'Last 30 days' },
//   { value: 'last_90_days', label: 'Last 90 days' },
//   { value: 'custom', label: 'Custom range' },
// ];

// Default timeframe used when saving rules (TimeFrame UI removed)
const DEFAULT_TIMEFRAME: TimeFrame = {
  period: 'last_7_days', // Changed to 'last_7_days' as a sensible default
};

export function EventConfigurationForm({ rule, onSave, onCancel }: EventConfigurationFormProps) {
  const toast = useToast();
  const [localRule, setLocalRule] = useState<CleverTapStyleRule>(() => ({
    ...rule,
    timeFrame: rule.timeFrame ?? DEFAULT_TIMEFRAME,
  }));
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(rule.eventName ?? undefined);
  const selectedEvent = useMemo<EnhancedShopifyEvent | undefined>(
    () => (selectedEventId ? getEnhancedEventById(selectedEventId) : undefined),
    [selectedEventId],
  );
  const availableProperties = useMemo<ShopifyEventProperty[]>(() => selectedEvent?.properties ?? [], [selectedEvent]);

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

  // TimeFrame handlers removed - UI no longer displays timeframe selector
  // Default timeframe is set automatically when saving (see handleSubmit)

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
    // TimeFrame removed from UI - set default value automatically
    const ruleToSave: CleverTapStyleRule = {
      ...localRule,
      timeFrame: localRule.timeFrame ?? DEFAULT_TIMEFRAME,
    };
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
            {/* Action selector - TimeFrame removed, using single column layout */}
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

