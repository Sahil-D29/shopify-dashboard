"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GoalEventFilter, GoalEventOperator } from "@/lib/types/goal-config";

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
];

interface EventFilterBuilderProps {
  filters: GoalEventFilter[];
  onChange: (filters: GoalEventFilter[]) => void;
  availableProperties?: Array<{ key: string; label: string }>;
  disabled?: boolean;
}

export function EventFilterBuilder({
  filters,
  onChange,
  availableProperties = [],
  disabled = false,
}: EventFilterBuilderProps) {
  const propertyOptions = useMemo(() => {
    if (!availableProperties.length) {
      return [{ key: "", label: "Event property" }];
    }
    return availableProperties;
  }, [availableProperties]);

  const handleFilterChange = (index: number, updates: Partial<GoalEventFilter>) => {
    const next = filters.map((filter, idx) => (idx === index ? { ...filter, ...updates } : filter));
    onChange(next);
  };

  const handleAddFilter = () => {
    onChange([
      ...filters,
      {
        property: propertyOptions[0]?.key ?? "",
        operator: "equals",
        value: "",
      },
    ]);
  };

  const handleRemoveFilter = (index: number) => {
    onChange(filters.filter((_, idx) => idx !== index));
  };

  return (
    <section className="space-y-3 rounded-2xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#312E81]">Event property filters</p>
          <p className="text-xs text-[#6366F1]">Restrict which event occurrences qualify for this goal.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleAddFilter} disabled={disabled} className="gap-1">
          <Plus className="h-4 w-4" />
          Add filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#C7D2FE] bg-white px-3 py-2 text-xs text-[#4F46E5]">
          No filters applied. All matching events will count toward this goal.
        </p>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div key={`${filter.property}-${index}`} className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 md:grid-cols-[1fr_160px_1fr_auto]">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.25em] text-[#94A3B8]">Property</Label>
                <Select
                  value={filter.property}
                  onValueChange={property => handleFilterChange(index, { property })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Event property" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyOptions.map(option => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label || option.key || "Property"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.25em] text-[#94A3B8]">Operator</Label>
                <Select
                  value={filter.operator}
                  onValueChange={operator => handleFilterChange(index, { operator: operator as GoalEventOperator })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-[0.25em] text-[#94A3B8]">Value</Label>
                <Input
                  placeholder="Enter a value"
                  value={typeof filter.value === 'string' || typeof filter.value === 'number' ? String(filter.value) : ""}
                  onChange={event => handleFilterChange(index, { value: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end text-[#9CA3AF] hover:text-red-500"
                onClick={() => handleRemoveFilter(index)}
                disabled={disabled}
                aria-label="Remove filter"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}



