"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { WaitForEventConfig } from "@/lib/types/delay-config";
import type { OperatorType } from "@/lib/types/condition-config";

interface EventDefinition {
  name: string;
  category: string;
  label: string;
  description?: string;
  properties?: Array<{ key: string; type: string }>;
}

type RawEventDefinition = {
  name?: string;
  category?: string;
  label?: string;
  description?: string;
  properties?: Array<{ key: string; type: string }>;
};

type EventsResponse = {
  events?: RawEventDefinition[];
};

const OPERATOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
];

interface EventSelectorProps {
  value: string;
  onChange: (eventName: string) => void;
  eventFilters?: WaitForEventConfig["eventFilters"];
  onFiltersChange?: (filters: WaitForEventConfig["eventFilters"]) => void;
  disabled?: boolean;
}

export function EventSelector({ value, onChange, eventFilters = [], onFiltersChange, disabled = false }: EventSelectorProps) {
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/events")
      .then(async response => {
        if (!response.ok) throw new Error("Failed to load events");
        const data = (await response.json()) as EventsResponse;
        const mapped: EventDefinition[] = (data.events ?? [])
          .map(event => ({
            name: event.name ?? "",
            category: event.category ?? "general",
            label: event.label ?? event.name ?? "",
            ...(event.description !== undefined && { description: event.description }),
            ...(event.properties && event.properties.length > 0 && { properties: event.properties }),
          }))
          .filter((event): event is EventDefinition => Boolean(event.name));
        setEvents(mapped);
        setError(null);
      })
      .catch(err => {
        console.error("[EventSelector] events", err);
        setError(err?.message ?? "Unable to load events.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter(event =>
      [event.label, event.name, event.description, event.category]
        .filter(Boolean)
        .some(field => field?.toLowerCase().includes(query)),
    );
  }, [events, searchQuery]);

  const selectedEvent = events.find(event => event.name === value);

  const handleFilterChange = (index: number, updates: Partial<NonNullable<WaitForEventConfig["eventFilters"]>[number]>) => {
    if (!onFiltersChange) return;
    const next = eventFilters.map((filter, idx) => (idx === index ? { ...filter, ...updates } : filter));
    onFiltersChange(next);
  };

  const handleAddFilter = () => {
    if (!onFiltersChange) return;
    const defaultProperty = selectedEvent?.properties?.[0]?.key ?? "";
    onFiltersChange([
      ...eventFilters,
      {
        property: defaultProperty,
        operator: "equals",
        value: "",
      },
    ]);
  };

  const handleDeleteFilter = (index: number) => {
    if (!onFiltersChange) return;
    onFiltersChange(eventFilters.filter((_, idx) => idx !== index));
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Event to wait for</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            placeholder="Search events…"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            className="pl-10"
            disabled={disabled}
          />
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white">
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading events…
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : filteredEvents.length ? (
              filteredEvents.map(event => {
                const isSelected = event.name === value;
                return (
                  <button
                    key={event.name}
                    type="button"
                    className={cn(
                      "w-full border-b border-[#E2E8F0] px-4 py-3 text-left transition last:border-none",
                      isSelected ? "bg-[#EEF2FF]" : "hover:bg-[#F8FAFC]",
                    )}
                    onClick={() => onChange(event.name)}
                    disabled={disabled}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#1E293B]">{event.label}</p>
                      <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#475569]">
                        {event.category}
                      </span>
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-xs text-[#64748B]">{event.description}</p>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-[#64748B]">No events match “{searchQuery}”.</p>
            )}
          </div>
        </div>
      </div>

      {selectedEvent ? (
        <div className="space-y-3 rounded-2xl border border-[#E0E7FF] bg-[#F5F3FF] px-4 py-3 text-xs text-[#4C1D95]">
          <p>
            Waiting for <span className="font-semibold text-[#4338CA]">{selectedEvent.label}</span>. When this event fires,
            the journey resumes. Add attribute filters below to restrict which occurrences qualify.
          </p>
          {selectedEvent.properties && selectedEvent.properties.length ? (
            <p className="text-[#6B21A8]">
              Available attributes: {selectedEvent.properties.map(property => property.key).join(", ")}
            </p>
          ) : (
            <p>No structured properties provided for this event.</p>
          )}
        </div>
      ) : null}

      {onFiltersChange ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#312E81]">Event filters (optional)</p>
              <p className="text-xs text-[#6366F1]">
                Only continue when the event payload matches these attribute rules.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddFilter}
              disabled={disabled || !selectedEvent}
              className="border-[#C7D2FE] text-[#312E81] hover:bg-[#E0E7FF]"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add filter
            </Button>
          </div>

          {eventFilters.length === 0 ? (
            <p className="text-xs text-[#6B7280]">
              No filters applied. All occurrences of the selected event will resume the journey.
            </p>
          ) : (
            <div className="space-y-3">
              {eventFilters.map((filter, index) => (
                <div
                  key={`${filter.property}-${index}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E0E7FF] bg-white px-3 py-3"
                >
                  <Select
                    value={filter.property}
                    onValueChange={property => handleFilterChange(index, { property })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Property" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedEvent?.properties ?? []).map(property => (
                        <SelectItem key={property.key} value={property.key}>
                          {property.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={operator => handleFilterChange(index, { operator: operator as OperatorType })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={typeof filter.value === 'string' || typeof filter.value === 'number' ? String(filter.value) : ""}
                    onChange={event => handleFilterChange(index, { value: event.target.value })}
                    placeholder="Value"
                    disabled={disabled}
                    className="w-60"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFilter(index)}
                    disabled={disabled}
                    className="text-[#9CA3AF] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
