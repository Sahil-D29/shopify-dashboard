'use client';

import { useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventSelector } from '@/components/journeys/builder/trigger/EventSelector';
import { PropertyConditionRow } from '@/components/journeys/builder/trigger/PropertyConditionRow';
import { getEnhancedEventById } from '@/constants/shopifyEvents';
import type { EnhancedShopifyEvent, ShopifyEventProperty } from '@/constants/shopifyEvents';
import type { EventCondition } from '@/lib/types/trigger-config';

export interface EventRule {
  id: string;
  eventName: string;
  eventDisplayName?: string;
  action: 'did' | 'did_not';
  conditions: EventCondition[];
}

interface EventRuleRowProps {
  rule: EventRule;
  onChange: (rule: EventRule) => void;
  onRemove: () => void;
}

export function EventRuleRow({ rule, onChange, onRemove }: EventRuleRowProps) {
  const selectedEvent = useMemo<EnhancedShopifyEvent | undefined>(
    () => (rule.eventName ? getEnhancedEventById(rule.eventName) : undefined),
    [rule.eventName],
  );

  const availableProperties = useMemo<ShopifyEventProperty[]>(
    () => selectedEvent?.properties ?? [],
    [selectedEvent],
  );

  const handleEventSelect = (event: EnhancedShopifyEvent) => {
    onChange({
      ...rule,
      eventName: event.id,
      eventDisplayName: event.label,
      conditions: [],
    });
  };

  const handleActionChange = (action: string) => {
    onChange({ ...rule, action: action as 'did' | 'did_not' });
  };

  const handleAddCondition = () => {
    if (!availableProperties.length) return;
    const newCondition: EventCondition = {
      id: nanoid(),
      property: availableProperties[0].name,
      operator: 'equals',
      value: '',
    };
    onChange({ ...rule, conditions: [...rule.conditions, newCondition] });
  };

  const handleConditionUpdate = (conditionId: string, updates: Partial<EventCondition>) => {
    onChange({
      ...rule,
      conditions: rule.conditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c,
      ),
    });
  };

  const handleConditionRemove = (conditionId: string) => {
    onChange({
      ...rule,
      conditions: rule.conditions.filter((c) => c.id !== conditionId),
    });
  };

  return (
    <div className="rounded-xl border border-[#E8E4DE] bg-white p-4 space-y-4">
      {/* Header with remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8B7F76]">
            Event Rule
          </span>
          {rule.eventDisplayName && (
            <span className="text-xs text-[#D4A574] font-medium">
              — {rule.eventDisplayName}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
          title="Remove event rule"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Event selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#4A4139]">Event</label>
        <EventSelector
          selectedEventId={rule.eventName || undefined}
          onSelectEvent={handleEventSelect}
          placeholder="Choose a Shopify event..."
        />
      </div>

      {/* Action selector */}
      {rule.eventName && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#4A4139]">Action</label>
          <Select value={rule.action} onValueChange={handleActionChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="did">Did</SelectItem>
              <SelectItem value="did_not">Did Not</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Property filters */}
      {rule.eventName && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#4A4139]">Property Filters</p>
              <p className="text-xs text-[#8B7F76]">
                {availableProperties.length > 0
                  ? 'Narrow down by event properties'
                  : 'No properties available for this event'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCondition}
              disabled={!availableProperties.length}
              className="text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add filter
            </Button>
          </div>

          {rule.conditions.length > 0 && (
            <div className="space-y-2">
              {rule.conditions.map((condition, index) => (
                <div key={condition.id} className="space-y-1">
                  {index > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-[#8B7F76] px-1">
                      <div className="h-px flex-1 bg-[#E8E4DE]" />
                      AND
                      <div className="h-px flex-1 bg-[#E8E4DE]" />
                    </div>
                  )}
                  <PropertyConditionRow
                    condition={condition}
                    availableProperties={availableProperties}
                    onUpdate={(updates) => handleConditionUpdate(condition.id, updates)}
                    onRemove={() => handleConditionRemove(condition.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {rule.conditions.length === 0 && availableProperties.length > 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
              No filters added. Click "Add filter" to narrow by event properties.
            </div>
          )}
        </div>
      )}

      {/* Empty state when no event selected */}
      {!rule.eventName && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Select an event above to configure this rule.
        </div>
      )}
    </div>
  );
}
