'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash } from 'lucide-react';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { fetchEventProperties } from './api';
import type { EventFilter } from './types';
import { DynamicValueInput } from '@/components/journeys/nodes/trigger/DynamicValueInput';

const OPERATOR_OPTIONS: Array<{ value: EventFilter['operator']; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'in', label: 'In list' },
  { value: 'not_in', label: 'Not in list' },
  { value: 'exists', label: 'Exists' },
];

interface PropertyMetadata {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  exampleValues?: Array<string | number>;
}

interface EventPropertiesFiltersProps {
  events: string[];
  filters: EventFilter[];
  onChange: (filters: EventFilter[]) => void;
  disabled?: boolean;
}

export function EventPropertiesFilters({ events, filters, onChange, disabled }: EventPropertiesFiltersProps) {
  const [metadata, setMetadata] = useState<Record<string, PropertyMetadata[]>>({});
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (events.length === 0) {
        setMetadata({});
        return;
      }

      const eventName = events[0];
      if (metadata[eventName]) return;

      try {
        setLoadingEvent(eventName);
        const props = await fetchEventProperties(eventName);
        setMetadata(prev => ({
          ...prev,
          [eventName]: props,
        }));
      } catch (error) {
        console.error('Unable to load event properties', error);
      } finally {
        setLoadingEvent(null);
      }
    };

    void load();
  }, [events, metadata]);

  const availableProperties = useMemo<PropertyMetadata[]>(() => {
    if (events.length === 0) return [];
    return metadata[events[0]] ?? [];
  }, [events, metadata]);

  const handleAddFilter = () => {
    onChange([
      ...filters,
      {
        id: nanoid(),
        property: '',
        operator: 'equals',
        value: '',
        conjunction: 'AND',
      },
    ]);
  };

  const handleUpdate = (id: string, patch: Partial<EventFilter>) => {
    onChange(filters.map(filter => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const handleRemove = (id: string) => {
    onChange(filters.filter(filter => filter.id !== id));
  };

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Event Property Filters
        </h3>
        <p className="text-xs text-slate-500">
          Add filters to refine the selected events.
        </p>
      </header>
      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          Select an event above to unlock property filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map(filter => {
            const property = availableProperties.find(item => item.name === filter.property);
            return (
              <div
                key={filter.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center"
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <Select
                    disabled={disabled || Boolean(loadingEvent)}
                    value={filter.property}
                    onValueChange={value => handleUpdate(filter.id, { property: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingEvent ? 'Loading…' : 'Event property'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProperties.map(property => (
                        <SelectItem key={property.name} value={property.name}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filter.operator}
                    disabled={disabled}
                    onValueChange={value =>
                      handleUpdate(filter.id, {
                        operator: value as EventFilter['operator'],
                        value: value === 'exists' ? '' : filter.value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filter.operator === 'exists' ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Value not required
                    </div>
                  ) : (
                    <DynamicValueInput
                      propertyId={filter.property}
                      operator={filter.operator}
                      value={filter.value}
                      onChange={(newValue) => handleUpdate(filter.id, { value: newValue })}
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(filter.id)}
                  disabled={disabled}
                >
                  <Trash className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddFilter}
            disabled={disabled || events.length === 0}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Filter
          </Button>
        </div>
      )}
    </section>
  );
}

EventPropertiesFilters.displayName = 'EventPropertiesFilters';

