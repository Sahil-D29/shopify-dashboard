'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/lib/tenant/tenant-context';
import {
  SEGMENT_FIELD_OPTIONS,
  getCustomEventSegmentFields,
  type SegmentFieldOption,
  type CustomEventDef,
} from '@/lib/constants/segment-fields';
import type { SubFilterProperty, SubFilterPropertyType } from '@/lib/constants/sub-filter-properties';

interface SegmentFieldsContextValue {
  /** Static fields + dynamic custom-event fields */
  options: SegmentFieldOption[];
  /** Grouped by `group` */
  optionsByGroup: Record<string, SegmentFieldOption[]>;
  getOption: (value: string) => SegmentFieldOption | undefined;
  /** Sub-filter properties for a custom event field, or null for non-custom fields */
  getCustomSubFilters: (value: string) => SubFilterProperty[] | null;
}

const buildByGroup = (opts: SegmentFieldOption[]): Record<string, SegmentFieldOption[]> =>
  opts.reduce((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {} as Record<string, SegmentFieldOption[]>);

const defaultValue: SegmentFieldsContextValue = {
  options: SEGMENT_FIELD_OPTIONS,
  optionsByGroup: buildByGroup(SEGMENT_FIELD_OPTIONS),
  getOption: (value) => SEGMENT_FIELD_OPTIONS.find(f => f.value === value),
  getCustomSubFilters: () => null,
};

const SegmentFieldsContext = createContext<SegmentFieldsContextValue>(defaultValue);

export const useSegmentFields = () => useContext(SegmentFieldsContext);

const SUBFILTER_TYPE = (t?: string): SubFilterPropertyType =>
  t === 'number' ? 'number' : t === 'date' ? 'date' : 'text';

export function SegmentFieldsProvider({ children }: { children: React.ReactNode }) {
  const { currentStore } = useTenant();
  const [customEvents, setCustomEvents] = useState<CustomEventDef[]>([]);

  useEffect(() => {
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (currentStore?.id) headers['x-store-id'] = currentStore.id;
    fetch('/api/settings/custom-events', { headers })
      .then(res => (res.ok ? res.json() : { events: [] }))
      .then((data: { events?: Array<{ eventName: string; displayName: string; properties?: Array<{ name: string; type?: string }> }> }) => {
        if (cancelled) return;
        setCustomEvents(
          (data.events || []).map(e => ({
            eventName: e.eventName,
            displayName: e.displayName,
            properties: e.properties || [],
          })),
        );
      })
      .catch(() => { /* custom events are optional */ });
    return () => { cancelled = true; };
  }, [currentStore?.id]);

  const value = useMemo<SegmentFieldsContextValue>(() => {
    const customFields = getCustomEventSegmentFields(customEvents);
    const options = [...SEGMENT_FIELD_OPTIONS, ...customFields];

    // Per-custom-event sub-filter properties, derived from the definition's properties
    const customSubFilters: Record<string, SubFilterProperty[]> = {};
    for (const ev of customEvents) {
      if (!ev.properties?.length) continue;
      customSubFilters[`custom_event:${ev.eventName}`] = ev.properties
        .filter(p => p.name?.trim())
        .map(p => ({
          name: p.name,
          label: p.name,
          type: SUBFILTER_TYPE(p.type),
          parentCategory: 'universal' as const,
        }));
    }

    const byValue = new Map(options.map(o => [o.value, o]));

    return {
      options,
      optionsByGroup: buildByGroup(options),
      getOption: (v: string) => byValue.get(v),
      getCustomSubFilters: (v: string) => customSubFilters[v] ?? null,
    };
  }, [customEvents]);

  return <SegmentFieldsContext.Provider value={value}>{children}</SegmentFieldsContext.Provider>;
}
