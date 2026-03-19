'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Check, ChevronsUpDown, Search,
  User, ShoppingCart, Package, MessageCircle, Target,
  GitBranch, Zap, MessageSquare, Contact, Activity,
  MousePointer, BarChart3, Brain, ShoppingBag,
} from 'lucide-react';
import {
  SEGMENT_FIELD_OPTIONS,
  SEGMENT_FIELD_GROUPS,
  getFieldOptionsByGroup,
  type SegmentFieldOption,
} from '@/lib/constants/segment-fields';

const ICON_MAP: Record<string, React.ElementType> = {
  User, ShoppingCart, Package, MessageCircle, Target,
  GitBranch, Zap, MessageSquare, Contact, Activity,
  MousePointer, BarChart3, Brain, ShoppingBag,
};

interface FieldSelectProps {
  value: string;
  onValueChange: (field: string) => void;
  className?: string;
}

export function FieldSelect({ value, onValueChange, className }: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const grouped = useMemo(() => getFieldOptionsByGroup(), []);

  const selectedField = SEGMENT_FIELD_OPTIONS.find(f => f.value === value);
  const displayLabel = selectedField?.label || 'Select field...';

  // Filter fields by search term
  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;

    const term = search.toLowerCase();
    const result: Record<string, SegmentFieldOption[]> = {};
    for (const [group, fields] of Object.entries(grouped)) {
      const matching = fields.filter(
        f => f.label.toLowerCase().includes(term) || f.value.toLowerCase().includes(term) || group.toLowerCase().includes(term)
      );
      if (matching.length > 0) result[group] = matching;
    }
    return result;
  }, [grouped, search]);

  // Determine which groups to show in the field list
  const visibleGroups = search.trim()
    ? Object.keys(filteredGrouped)
    : activeGroup
      ? [activeGroup]
      : Object.keys(grouped);

  // Count fields per group
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [group, fields] of Object.entries(grouped)) {
      counts[group] = fields.length;
    }
    return counts;
  }, [grouped]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(''); setActiveGroup(null); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between text-left font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="start">
        {/* Search bar */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
          />
        </div>

        <div className="flex">
          {/* Left: Category tabs */}
          {!search.trim() && (
            <ScrollArea className="w-[180px] border-r">
              <div className="py-1">
                <button
                  onClick={() => setActiveGroup(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors',
                    !activeGroup && 'bg-muted font-medium'
                  )}
                >
                  <span className="truncate">All Fields</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{SEGMENT_FIELD_OPTIONS.length}</span>
                </button>
                {SEGMENT_FIELD_GROUPS.map(({ name, icon }) => {
                  const Icon = ICON_MAP[icon];
                  const count = groupCounts[name] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={name}
                      onClick={() => setActiveGroup(name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors',
                        activeGroup === name && 'bg-muted font-medium'
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="truncate">{name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Right: Fields list */}
          <ScrollArea className="flex-1 max-h-[320px]">
            <div className="py-1">
              {visibleGroups.map(group => {
                const fields = filteredGrouped[group] || [];
                if (fields.length === 0) return null;

                const groupInfo = SEGMENT_FIELD_GROUPS.find(g => g.name === group);
                const Icon = groupInfo ? ICON_MAP[groupInfo.icon] : null;

                return (
                  <div key={group}>
                    {/* Group header */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 sticky top-0">
                      {Icon && <Icon className="h-3 w-3" />}
                      {group}
                    </div>

                    {/* Fields */}
                    {fields.map((field: SegmentFieldOption) => {
                      const isSelected = field.value === value;
                      const isDisabled = field.status === 'coming_soon' || field.status === 'requires_app';
                      return (
                        <button
                          key={field.value}
                          onClick={() => {
                            if (!isDisabled) {
                              onValueChange(field.value);
                              setOpen(false);
                              setSearch('');
                              setActiveGroup(null);
                            }
                          }}
                          disabled={isDisabled}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-muted/50 transition-colors',
                            isSelected && 'bg-primary/10',
                            isDisabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <Check className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
                          <span className="truncate">{field.label}</span>
                          <span className="ml-auto flex items-center gap-1">
                            {field.supportsSubFilters && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                                filters
                              </Badge>
                            )}
                            {field.status === 'coming_soon' && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                                Soon
                              </Badge>
                            )}
                            {field.status === 'requires_app' && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                                App
                              </Badge>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {Object.keys(filteredGrouped).length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No fields match &quot;{search}&quot;
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
