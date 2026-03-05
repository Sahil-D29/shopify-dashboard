'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

export interface EntityOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface EntitySearchSelectProps {
  value: string;
  onValueChange: (value: string, label: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  fetchUrl: string;
  parseResponse: (data: any) => EntityOption[];
  disabled?: boolean;
  className?: string;
}

export function EntitySearchSelect({
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  fetchUrl,
  parseResponse,
  disabled = false,
  className,
}: EntitySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cachedRef = useRef(false);

  const fetchOptions = useCallback(async () => {
    if (cachedRef.current && options.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const url = fetchUrl.startsWith('http') ? fetchUrl : `${baseUrl}${fetchUrl}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      const parsed = parseResponse(data);
      setOptions(parsed);
      cachedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options');
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, parseResponse, options.length]);

  useEffect(() => {
    if (open && !cachedRef.current) {
      fetchOptions();
    }
  }, [open, fetchOptions]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption?.label || (value ? value : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between text-left font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command loop>
          <CommandInput placeholder={searchPlaceholder} />
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-destructive">{error}</div>
          ) : (
            <>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <ScrollArea className="max-h-64">
                <CommandGroup>
                  {options.map(option => {
                    const isSelected = option.value === value;
                    return (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.subtitle ?? ''}`}
                        onSelect={() => {
                          onValueChange(option.value, option.label);
                          setOpen(false);
                        }}
                        className="flex items-center gap-2 py-2"
                      >
                        <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{option.label}</span>
                          {option.subtitle && (
                            <span className="text-xs text-muted-foreground truncate">{option.subtitle}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </ScrollArea>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
