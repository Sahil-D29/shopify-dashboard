'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  SEGMENT_FIELD_OPTIONS,
  getFieldOptionsByGroup,
  type SegmentFieldOption,
} from '@/lib/constants/segment-fields';

interface FieldSelectProps {
  value: string;
  onValueChange: (field: string) => void;
  className?: string;
}

export function FieldSelect({ value, onValueChange, className }: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const grouped = getFieldOptionsByGroup();

  const selectedField = SEGMENT_FIELD_OPTIONS.find(f => f.value === value);
  const displayLabel = selectedField?.label || 'Select field...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command loop>
          <CommandInput placeholder="Search fields..." />
          <CommandEmpty>No field found.</CommandEmpty>
          <ScrollArea className="max-h-72">
            {Object.entries(grouped).map(([group, fields]) => (
              <CommandGroup key={group} heading={group}>
                {fields.map((field: SegmentFieldOption) => {
                  const isSelected = field.value === value;
                  const isDisabled = field.status === 'coming_soon' || field.status === 'requires_app';
                  return (
                    <CommandItem
                      key={field.value}
                      value={`${field.label} ${group}`}
                      onSelect={() => {
                        if (!isDisabled) {
                          onValueChange(field.value);
                          setOpen(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={cn(
                        'flex items-center gap-2',
                        isDisabled && 'opacity-50'
                      )}
                    >
                      <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate text-sm">{field.label}</span>
                      {field.status === 'coming_soon' && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 h-4">
                          Soon
                        </Badge>
                      )}
                      {field.status === 'requires_app' && (
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0 h-4">
                          Requires App
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
