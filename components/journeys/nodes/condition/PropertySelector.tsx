"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Clock } from "lucide-react";

import type { PropertyDefinition } from "@/lib/types/condition-config";

export interface PropertyCategory {
  label: string;
  properties: PropertyDefinition[];
}

interface PropertySelectorProps {
  categories: PropertyCategory[];
  value?: PropertyDefinition | null;
  recentPropertyIds?: string[];
  onSelect: (property: PropertyDefinition) => void;
  disabled?: boolean;
}

function propertyTypeBadge(type: PropertyDefinition["type"]) {
  switch (type) {
    case "string":
      return { label: "Text", className: "bg-[#E8E4DE] text-[#4A4139]" };
    case "number":
      return { label: "Number", className: "bg-[#E1ECF4] text-[#1F4D7A]" };
    case "boolean":
      return { label: "Boolean", className: "bg-[#E3F4E4] text-[#215737]" };
    case "date":
      return { label: "Date", className: "bg-[#F4E7FF] text-[#5B2C81]" };
    case "array":
      return { label: "List", className: "bg-[#FFF2DE] text-[#7C4A13]" };
    case "object":
      return { label: "Object", className: "bg-[#E6E6E6] text-[#2F2F2F]" };
    default:
      return { label: type, className: "bg-[#E8E4DE] text-[#4A4139]" };
  }
}

export function PropertySelector({
  categories,
  value,
  onSelect,
  recentPropertyIds = [],
  disabled = false,
}: PropertySelectorProps) {
  const [open, setOpen] = useState(false);
  const flattened = useMemo(() => categories.flatMap(category => category.properties), [categories]);

  const selectedLabel = value ? value.label : "Select property";
  const selectedDescription = value?.description;

  const recentProperties = useMemo(() => {
    if (!recentPropertyIds.length) return [];
    return recentPropertyIds
      .map(id => flattened.find(prop => prop.id === id))
      .filter((prop): prop is PropertyDefinition => Boolean(prop));
  }, [flattened, recentPropertyIds]);

  const hasRecent = recentProperties.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-[#E8E4DE] text-left"
        >
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium text-[#4A4139]">{selectedLabel}</span>
            {selectedDescription ? (
              <span className="text-xs text-[#8B7F76]">{selectedDescription}</span>
            ) : null}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command loop>
          <CommandInput placeholder="Search properties..." />
          <CommandEmpty>No properties found.</CommandEmpty>
          <ScrollArea className="max-h-80">
            {hasRecent ? (
              <CommandGroup heading={
                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#B9AA9F]">
                  <Clock className="h-3 w-3" /> Recent properties
                </div>
              }>
                {recentProperties.map(property => {
                  const badge = propertyTypeBadge(property.type);
                  const isSelected = value?.id === property.id;
                  return (
                    <CommandItem
                      key={property.id}
                      onSelect={() => {
                        onSelect(property);
                        setOpen(false);
                      }}
                      className="flex items-start gap-2 py-2"
                    >
                      <div
                        className={cn(
                          "mt-1 h-4 w-4 flex-shrink-0 rounded-full border border-[#D9CABD] text-[#B8977F]",
                          isSelected ? "bg-[#D4A574]/20" : "bg-transparent",
                        )}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#4A4139]">{property.label}</span>
                          <Badge className={cn("text-xs font-semibold", badge.className)}>{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-[#8B7F76]">{property.description}</p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {categories.map(category => (
              <CommandGroup
                key={category.label}
                heading={
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B9AA9F]">
                    {category.label}
                  </span>
                }
              >
                {category.properties.map(property => {
                  const badge = propertyTypeBadge(property.type);
                  const isSelected = value?.id === property.id;
                  return (
                    <CommandItem
                      key={property.id}
                      value={`${property.label} ${property.description ?? ""} ${property.path}`}
                      onSelect={() => {
                        onSelect(property);
                        setOpen(false);
                      }}
                      className="flex items-start gap-2 py-2"
                    >
                      <div
                        className={cn(
                          "mt-1 h-4 w-4 flex-shrink-0 rounded-full border border-[#D9CABD] text-[#B8977F]",
                          isSelected ? "bg-[#D4A574]/20" : "bg-transparent",
                        )}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#4A4139]">{property.label}</span>
                          <Badge className={cn("text-xs font-semibold", badge.className)}>{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-[#8B7F76]">{property.description}</p>
                      </div>
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



