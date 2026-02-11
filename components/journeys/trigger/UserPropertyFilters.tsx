'use client';

import { useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserPropertyFilter } from './types';
import { fetchUserProperties, type UserProperty } from './api';
import { DynamicValueInput } from '@/components/journeys/nodes/trigger/DynamicValueInput';

interface UserPropertyFiltersProps {
  enabled: boolean;
  filters: UserPropertyFilter[];
  onToggle: (value: boolean) => void;
  onChange: (filters: UserPropertyFilter[]) => void;
  disabled?: boolean;
}

export function UserPropertyFilters({
  enabled,
  filters,
  onToggle,
  onChange,
  disabled,
}: UserPropertyFiltersProps) {
  const [properties, setProperties] = useState<UserProperty[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || properties.length > 0 || loading) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetchUserProperties();
        if (!cancelled) {
          setProperties(response);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load user properties', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, properties.length, loading]);

  const propertyLookup = useMemo(() => {
    const map = new Map<string, UserProperty>();
    properties.forEach(property => map.set(property.name, property));
    return map;
  }, [properties]);

  const addFilter = () => {
    onChange([
      ...filters,
      {
        id: nanoid(),
        property: '',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<UserPropertyFilter>) => {
    onChange(filters.map(filter => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter(filter => filter.id !== id));
  };

  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            User Property Filters
          </h3>
          <p className="text-xs text-slate-500">
            Optionally refine the audience based on user attributes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={value => onToggle(value)}
            disabled={disabled}
          />
          <span className="text-xs text-slate-500">Enable filters</span>
        </div>
      </header>
      {!enabled ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          Toggle “Enable filters” to segment by user properties or past behaviour.
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map(filter => {
            const property = propertyLookup.get(filter.property);
            return (
              <div
                key={filter.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center"
              >
                <Select
                  value={filter.property}
                  disabled={disabled || loading}
                  onValueChange={value =>
                    updateFilter(filter.id, {
                      property: value,
                      value: '',
                    })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loading ? 'Loading…' : 'User property'} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(item => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filter.operator}
                  disabled={disabled}
                  onValueChange={value => updateFilter(filter.id, { operator: value })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Does not equal</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="not_contains">Does not contain</SelectItem>
                    <SelectItem value="in">In list</SelectItem>
                    <SelectItem value="exists">Exists</SelectItem>
                  </SelectContent>
                </Select>
                {filter.operator === 'exists' ? (
                  <div className="flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Value not required
                  </div>
                ) : (
                  <DynamicValueInput
                    propertyId={filter.property}
                    operator={filter.operator}
                    value={filter.value}
                    onChange={(newValue) => updateFilter(filter.id, { value: newValue })}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(filter.id)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addFilter}
            disabled={disabled}
          >
            + Add user filter
          </Button>
        </div>
      )}
    </section>
  );
}

UserPropertyFilters.displayName = 'UserPropertyFilters';

