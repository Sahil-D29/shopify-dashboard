"use client";

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X, Loader2, Search } from 'lucide-react';
import { getPropertyMetadata } from '@/lib/types/trigger-filter-metadata';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/useToast';

interface DynamicValueInputProps {
  propertyId: string;
  operator: string;
  value: any;
  onChange: (value: any) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function DynamicValueInput({
  propertyId,
  operator,
  value,
  onChange
}: DynamicValueInputProps) {
  const metadata = getPropertyMetadata(propertyId);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (metadata?.apiEndpoint && metadata.searchable) {
      fetchOptions(debouncedSearch);
    } else if (metadata?.apiEndpoint) {
      fetchOptions();
    }
  }, [propertyId, debouncedSearch]);

  const fetchOptions = useCallback(async (search?: string) => {
    if (!metadata?.apiEndpoint) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(`${metadata.apiEndpoint}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch options');
      const data = await res.json();
      if (data.items) setOptions(data.items);
      else if (data.options) setOptions(data.options);
      else if (data.products) setOptions(data.products);
      else if (Array.isArray(data)) setOptions(data);
      else setOptions([]);
    } catch (error) {
      console.error('Failed to fetch options:', error);
      toast.error('Failed to load options');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [metadata?.apiEndpoint, toast]);

  // No metadata - fallback to text input
  if (!metadata) {
    return (
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value..."
        className="w-48"
      />
    );
  }

  // For 'between' operator, show two inputs
  if (operator === 'between') {
    const rangeValue = typeof value === 'object' && value !== null ? value : { min: '', max: '' };
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={rangeValue.min || ''}
          onChange={(e) => onChange({ ...rangeValue, min: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="Min"
          className="w-24"
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          type="number"
          value={rangeValue.max || ''}
          onChange={(e) => onChange({ ...rangeValue, max: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="Max"
          className="w-24"
        />
      </div>
    );
  }

  const requiresMultiSelect = metadata.multiSelect || operator === 'in' || operator === 'not_in';

  // Shopify data with searchable dropdown (single select)
  if (metadata.valueType.startsWith('shopify_') && metadata.searchable && !requiresMultiSelect) {
    const selectedOption = options.find((option) => {
      const optionValue = option[metadata.valueField || 'id'];
      return String(optionValue) === String(value);
    });
    const displayValue = selectedOption?.[metadata.labelField || 'title'] || value || 'Choose value...';

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-w-[200px]"
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          {/* Search input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${metadata.label.toLowerCase()}...`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ScrollArea className="max-h-[260px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              <div className="py-1">
                {options.map((option, idx) => {
                  const optionValue = option[metadata.valueField || 'id'];
                  const optionLabel = option[metadata.labelField || 'title'];
                  const isSelected = String(optionValue) === String(value);

                  return (
                    <button
                      key={`${optionValue}-${idx}`}
                      onClick={() => {
                        onChange(optionValue);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      <Check
                        className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')}
                      />
                      {metadata.valueType === 'shopify_product' && option.image && (
                        <img
                          src={option.image}
                          alt={optionLabel}
                          className="w-8 h-8 object-cover rounded"
                        />
                      )}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{optionLabel}</span>
                        {option.price && (
                          <span className="text-xs text-muted-foreground">${option.price}</span>
                        )}
                        {option.sku && (
                          <span className="text-xs text-muted-foreground">SKU: {option.sku}</span>
                        )}
                      </div>
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

  // Shopify data with multi-select
  if (metadata.valueType.startsWith('shopify_') && requiresMultiSelect) {
    const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

    return (
      <div className="space-y-2 w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between min-w-[200px]"
            >
              {selectedValues.length > 0
                ? `${selectedValues.length} selected`
                : "Choose value..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            {/* Search input */}
            <div className="flex items-center border-b px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${metadata.label.toLowerCase()}...`}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <ScrollArea className="max-h-[260px]">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : options.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              ) : (
                <div className="py-1">
                  {options.map((option, idx) => {
                    const optionValue = option[metadata.valueField || 'id'];
                    const optionLabel = option[metadata.labelField || 'title'];
                    const isSelected = selectedValues.some(v => String(v) === String(optionValue));

                    return (
                      <button
                        key={`${optionValue}-${idx}`}
                        onClick={() => {
                          const newValues = isSelected
                            ? selectedValues.filter((v: any) => String(v) !== String(optionValue))
                            : [...selectedValues, optionValue];
                          onChange(newValues);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                          isSelected && 'bg-primary/10'
                        )}
                      >
                        <Check
                          className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')}
                        />
                        {metadata.valueType === 'shopify_product' && option.image && (
                          <img
                            src={option.image}
                            alt={optionLabel}
                            className="w-8 h-8 object-cover rounded"
                          />
                        )}
                        <span className="truncate">{optionLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((val: any) => {
              const option = options.find((o) => {
                const optionValue = o[metadata.valueField || 'id'];
                return String(optionValue) === String(val);
              });
              const label = option?.[metadata.labelField || 'title'] || val;

              return (
                <Badge key={String(val)} variant="secondary" className="gap-1">
                  {String(label)}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      onChange(selectedValues.filter((v: any) => String(v) !== String(val)));
                    }}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Static dropdown (order status, fulfillment status, etc.)
  if (metadata.apiEndpoint && !metadata.searchable) {
    return (
      <Select
        value={value != null ? String(value) : ''}
        onValueChange={(val) => onChange(val)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const optionValue = option[metadata.valueField || 'value'] || option.value;
            const optionLabel = option[metadata.labelField || 'label'] || option.label || optionValue;
            return (
              <SelectItem key={optionValue} value={String(optionValue)}>
                {optionLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  // Number input
  if (metadata.valueType === 'number') {
    return (
      <Input
        type="number"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder="Enter number..."
        className="w-48"
      />
    );
  }

  // Date input
  if (metadata.valueType === 'date') {
    return (
      <Input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-48"
      />
    );
  }

  // Boolean input
  if (metadata.valueType === 'boolean') {
    return (
      <Select value={value === true ? 'true' : value === false ? 'false' : ''} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Default: text input
  return (
    <Input
      type="text"
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
      className="w-48"
    />
  );
}
