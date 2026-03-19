'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SubFilter } from '@/lib/types/segment';
import {
  type SubFilterProperty,
  getSubFilterOperators,
} from '@/lib/constants/sub-filter-properties';
import { useTenant } from '@/lib/tenant/tenant-context';

interface SubFilterRowProps {
  subFilter: SubFilter;
  availableProperties: SubFilterProperty[];
  onChange: (updated: SubFilter) => void;
  onRemove: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function SubFilterRow({ subFilter, availableProperties, onChange, onRemove }: SubFilterRowProps) {
  const { currentStore } = useTenant();
  const selectedProp = availableProperties.find(p => p.name === subFilter.property);
  const propType = selectedProp?.type ?? 'text';
  const operators = getSubFilterOperators(propType);

  const isNoValueOp = subFilter.operator === 'is_empty' || subFilter.operator === 'is_not_empty';

  // Smart dropdown state
  const hasApiEndpoint = !!selectedProp?.apiEndpoint;
  const hasStaticOptions = !!selectedProp?.staticOptions?.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch options from API
  const fetchOptions = useCallback(async (search?: string) => {
    if (!selectedProp?.apiEndpoint) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const headers: Record<string, string> = {};
      if (currentStore?.id) headers['x-store-id'] = currentStore.id;
      const res = await fetch(`${selectedProp.apiEndpoint}?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Handle various response formats
      const items = data.items || data.options || data.products || data.templates ||
        data.tags || data.vendors || data.collections || (Array.isArray(data) ? data : []);
      setOptions(items);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProp?.apiEndpoint, currentStore?.id]);

  useEffect(() => {
    if (hasApiEndpoint && selectedProp?.searchable) {
      fetchOptions(debouncedSearch);
    } else if (hasApiEndpoint) {
      fetchOptions();
    }
  }, [hasApiEndpoint, selectedProp?.searchable, debouncedSearch, fetchOptions]);

  // Get display label for the current value
  const displayLabel = useMemo(() => {
    if (!subFilter.value && subFilter.value !== 0) return 'Select...';
    const strValue = String(subFilter.value);

    if (hasStaticOptions) {
      const opt = selectedProp?.staticOptions?.find(o => o.value === strValue);
      return opt?.label || strValue;
    }

    if (hasApiEndpoint && options.length > 0) {
      const valueField = selectedProp?.valueField || 'id';
      const labelField = selectedProp?.labelField || 'title';
      const found = options.find(o => String(o[valueField]) === strValue);
      if (found) return String(found[labelField]);
    }

    return strValue;
  }, [subFilter.value, hasStaticOptions, hasApiEndpoint, options, selectedProp]);

  // Render the value input based on property type
  const renderValueInput = () => {
    if (isNoValueOp) return null;

    // Static dropdown options (fulfillment status, campaign type, etc.)
    if (hasStaticOptions && selectedProp?.staticOptions) {
      return (
        <Select
          value={typeof subFilter.value === 'string' ? subFilter.value : String(subFilter.value ?? '')}
          onValueChange={(val) => onChange({ ...subFilter, value: val })}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {selectedProp.staticOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Searchable API dropdown (products, vendors, discount codes, etc.)
    if (hasApiEndpoint) {
      const valueField = selectedProp?.valueField || 'id';
      const labelField = selectedProp?.labelField || 'title';

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[180px] h-8 justify-between text-xs font-normal"
            >
              <span className="truncate">{displayLabel}</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            {/* Search input */}
            {selectedProp?.searchable && (
              <div className="flex items-center border-b px-3 py-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${selectedProp.label.toLowerCase()}...`}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            <ScrollArea className="max-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : options.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No results found.
                </div>
              ) : (
                <div className="py-1">
                  {options.map((option, idx) => {
                    const optValue = String(option[valueField] ?? option.value ?? option.name ?? '');
                    const optLabel = String(option[labelField] ?? option.label ?? option.title ?? option.name ?? optValue);
                    const isSelected = String(subFilter.value) === optValue;

                    return (
                      <button
                        key={`${optValue}-${idx}`}
                        onClick={() => {
                          onChange({ ...subFilter, value: optValue });
                          setOpen(false);
                          setSearchQuery('');
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors',
                          isSelected && 'bg-primary/10'
                        )}
                      >
                        <Check
                          className={cn('h-3 w-3 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')}
                        />
                        <span className="truncate">{optLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      );
    }

    // Default: plain input
    return (
      <Input
        type={propType === 'number' ? 'number' : propType === 'date' ? 'date' : 'text'}
        value={typeof subFilter.value === 'string' ? subFilter.value : String(subFilter.value ?? '')}
        onChange={(e) =>
          onChange({
            ...subFilter,
            value: propType === 'number' ? Number(e.target.value) : e.target.value,
          })
        }
        placeholder="Enter value..."
        className="w-[160px] h-8 text-xs"
      />
    );
  };

  return (
    <div className="flex items-center gap-2 pl-6 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">where</span>

      {/* Property selector */}
      <Select
        value={subFilter.property}
        onValueChange={(prop) => {
          const newPropType = availableProperties.find(p => p.name === prop)?.type ?? 'text';
          const defaultOp = getSubFilterOperators(newPropType)[0]?.value ?? 'equals';
          onChange({ ...subFilter, property: prop, operator: defaultOp as SubFilter['operator'], value: '' });
        }}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Property" />
        </SelectTrigger>
        <SelectContent>
          {availableProperties.map(prop => (
            <SelectItem key={prop.name} value={prop.name} className="text-xs">
              {prop.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={subFilter.operator}
        onValueChange={(op) => onChange({ ...subFilter, operator: op as SubFilter['operator'] })}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input - smart dropdown or plain input */}
      {renderValueInput()}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
