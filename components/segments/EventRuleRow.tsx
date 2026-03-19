'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(rule.conditions.length > 0);

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
    setIsExpanded(true);
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
    <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Compact main row */}
      <div className="flex items-center gap-2 p-3">
        {/* Event badge */}
        <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Event selector */}
        <div className="flex-1 min-w-0">
          <EventSelector
            selectedEventId={rule.eventName || undefined}
            onSelectEvent={handleEventSelect}
            placeholder="Select event..."
          />
        </div>

        {/* Action selector */}
        {rule.eventName && (
          <Select value={rule.action} onValueChange={handleActionChange}>
            <SelectTrigger className="w-28 shrink-0">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="did">Did</SelectItem>
              <SelectItem value="did_not">Did Not</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Property filter toggle */}
        {rule.eventName && availableProperties.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`shrink-0 transition-colors ${isExpanded ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Toggle property filters"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}

        {/* Remove */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Remove event rule"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expandable property filters */}
      {rule.eventName && isExpanded && (
        <div className="border-t border-primary/10 bg-card px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Property Filters
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddCondition}
              disabled={!availableProperties.length}
              className="h-6 text-xs text-primary hover:text-primary/80"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add filter
            </Button>
          </div>

          {rule.conditions.length > 0 ? (
            <div className="space-y-1.5">
              {rule.conditions.map((condition, index) => (
                <div key={condition.id}>
                  {index > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground px-1 py-0.5">
                      <div className="h-px flex-1 bg-border" />
                      AND
                      <div className="h-px flex-1 bg-border" />
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
          ) : (
            <p className="text-xs text-muted-foreground py-1">
              No filters added. Click &quot;Add filter&quot; to narrow by event properties.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
