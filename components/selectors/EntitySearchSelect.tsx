'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useTenant } from '@/lib/tenant/tenant-context';

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
  const [search, setSearch] = useState('');
  const cachedRef = useRef(false);
  const { currentStore } = useTenant();

  const fetchOptions = useCallback(async () => {
    if (cachedRef.current && options.length > 0) return;
    setLoading(true);
    setError(null);
    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const url = fetchUrl.startsWith('http') ? fetchUrl : `${baseUrl}${fetchUrl}`;
      const headers: Record<string, string> = {};
      if (currentStore?.id) headers['x-store-id'] = currentStore.id;
      const res = await fetch(url, { cache: 'no-store', headers });
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
  }, [fetchUrl, parseResponse, options.length, currentStore?.id]);

  useEffect(() => {
    if (open && !cachedRef.current) {
      fetchOptions();
    }
  }, [open, fetchOptions]);

  // Invalidate cache when store changes
  useEffect(() => {
    cachedRef.current = false;
    setOptions([]);
  }, [currentStore?.id]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption?.label || (value ? value : placeholder);

  // Client-side search filtering
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(
      o => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term) || (o.subtitle?.toLowerCase().includes(term))
    );
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
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
        {/* Search input */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive">{error}</div>
        ) : filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="py-1">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onValueChange(option.value, option.label);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">{option.label}</span>
                      {option.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">{option.subtitle}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
