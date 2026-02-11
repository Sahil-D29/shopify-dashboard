'use client';

import { useEffect, useMemo, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

import { fetchEvents } from './api';
import { useDebouncedValue } from './useDebouncedValue';

interface EventSelectorProps {
  selectedEvents: string[];
  onChange: (events: string[]) => void;
  disabled?: boolean;
}

export function EventSelector({ selectedEvents, onChange, disabled }: EventSelectorProps) {
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<Array<{ name: string; displayName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchEvents(debouncedQuery);
        if (!ignore) {
          setEvents(result);
        }
      } catch (error) {
        if (!ignore) {
          setEvents([]);
          console.error('Unable to load events', error);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [debouncedQuery]);

  const suggestions = useMemo(() => {
    return events.filter(event => !selectedEvents.includes(event.name));
  }, [events, selectedEvents]);

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Event Selection
        </h3>
        <p className="text-xs text-slate-500">
          Choose one or more events to monitor.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {selectedEvents.map(eventName => (
          <Badge
            key={eventName}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {eventName}
            <button
              type="button"
              onClick={() => onChange(selectedEvents.filter(item => item !== eventName))}
              disabled={disabled}
              className="rounded-full p-0.5 hover:bg-slate-200"
              aria-label={`Remove ${eventName}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        {selectedEvents.length === 0 ? (
          <span className="text-xs text-slate-400">
            No events selected yet.
          </span>
        ) : null}
      </div>
      <Command className="rounded-lg border border-slate-200">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search events (e.g. Product Viewed, Order Placed)"
          disabled={disabled}
          aria-label="Search events"
        />
        <CommandEmpty>
          {loading ? 'Loading events…' : 'No events found.'}
        </CommandEmpty>
        <CommandGroup>
          {suggestions.map(event => (
            <CommandItem
              key={event.name}
              onSelect={() => {
                onChange([...selectedEvents, event.name]);
                setQuery('');
              }}
              disabled={disabled}
            >
              <div className="flex flex-col text-sm">
                <span>{event.displayName || event.name}</span>
                {event.displayName && event.displayName !== event.name ? (
                  <span className="text-xs text-slate-500">{event.name}</span>
                ) : null}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </Command>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            if (query && !selectedEvents.includes(query)) {
              onChange([...selectedEvents, query]);
              setQuery('');
            }
          }}
        >
          + Add Event
        </Button>
      </div>
    </section>
  );
}

EventSelector.displayName = 'EventSelector';

