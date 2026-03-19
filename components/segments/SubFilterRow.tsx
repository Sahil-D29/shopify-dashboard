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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { SubFilter } from '@/lib/types/segment';
import {
  type SubFilterProperty,
  getSubFilterOperators,
} from '@/lib/constants/sub-filter-properties';

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
  const selectedProp = availableProperties.find(p => p.name === subFilter.property);
  const propType = selectedProp?.type ?? 'text';
  const operators = getSubFilterOperators(propType);

  const isNoValueOp = subFilter.operator === 'is_empty' || subFilter.operator === 'is_not_empty';

  // Smart dropdown state
  const hasApiEndpoint = !!selectedProp?.apiEndpoint;
  const hasStaticOptions = !!selectedProp?.staticOptions?.length;
  const hasDropdown = hasApiEndpoint || hasStaticOptions;

  const [options, setOptions] = useState<Array<Record<string, string>>>([]);
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
      const res = await fetch(`${selectedProp.apiEndpoint}?${params}`);
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
  }, [selectedProp?.apiEndpoint]);

  useEffect(() => {
    if (hasApiEndpoint && selectedProp?.searchable) {
      fetchOptions(debouncedSearch);
    } else if (hasApiEndpoint) {
      fetchOptions();
    }
  }, [hasApiEndpoint, selectedProp?.searchable, debouncedSearch, fetchOptions]);

  // Get display label for the current value
  const displayLabel = useMemo(() => {
    if (!subFilter.value) return 'Select...';
    const strValue = String(subFilter.value);

    if (hasStaticOptions) {
      const opt = selectedProp?.staticOptions?.find(o => o.value === strValue);
      return opt?.label || strValue;
    }

    if (hasApiEndpoint && options.length > 0) {
      const valueField = selectedProp?.valueField || 'id';
      const labelField = selectedProp?.labelField || 'title';
      const found = options.find(o => String(o[valueField]) === strValue);
      return found?.[labelField] || strValue;
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
          <SelectTrigger className="w-[140px] h-8 text-xs">
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
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[160px] h-8 justify-between text-xs font-normal"
            >
              <span className="truncate">{displayLabel}</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              {selectedProp?.searchable && (
                <CommandInput
                  placeholder={`Search ${selectedProp.label.toLowerCase()}...`}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  className="text-xs"
                />
              )}
              <CommandList>
                <CommandEmpty>
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <span className="text-xs">No results found.</span>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((option, idx) => {
                    const valueField = selectedProp?.valueField || 'id';
                    const labelField = selectedProp?.labelField || 'title';
                    const optValue = String(option[valueField] ?? option.value ?? option.name ?? '');
                    const optLabel = String(option[labelField] ?? option.label ?? option.title ?? option.name ?? optValue);
                    const isSelected = String(subFilter.value) === optValue;

                    return (
                      <CommandItem
                        key={`${optValue}-${idx}`}
                        value={optValue}
                        onSelect={() => {
                          onChange({ ...subFilter, value: optValue });
                          setOpen(false);
                          setSearchQuery('');
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn('mr-2 h-3 w-3', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <span className="truncate">{optLabel}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
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
        className="w-[140px] h-8 text-xs"
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
