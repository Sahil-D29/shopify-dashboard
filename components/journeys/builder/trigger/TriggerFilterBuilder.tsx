'use client';

import { useMemo } from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';

import { getEnhancedEventById } from '@/constants/shopifyEvents';

/** Mirrors EngineCondition in lib/journey-engine/condition-evaluator. */
export interface TriggerFilter {
  source: 'customer' | 'order' | 'product';
  field: string;
  operator: string;
  value?: string;
}

interface TriggerFilterBuilderProps {
  /** The selected catalog event id, used to suggest event-property fields. */
  eventId: string;
  filters: TriggerFilter[];
  join: 'all' | 'any';
  onChange: (filters: TriggerFilter[], join: 'all' | 'any') => void;
}

const OPERATORS: Array<{ value: string; label: string; needsValue: boolean }> = [
  { value: 'equals', label: 'is', needsValue: true },
  { value: 'not_equals', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'starts_with', label: 'starts with', needsValue: true },
  { value: 'greater_than', label: 'greater than', needsValue: true },
  { value: 'less_than', label: 'less than', needsValue: true },
  { value: 'is_set', label: 'is set', needsValue: false },
  { value: 'is_not_set', label: 'is not set', needsValue: false },
];

/** Common customer attributes available on every trigger. */
const CUSTOMER_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'email', label: 'Email' },
  { field: 'phone', label: 'Phone' },
  { field: 'first_name', label: 'First name' },
  { field: 'last_name', label: 'Last name' },
  { field: 'tags', label: 'Tags' },
  { field: 'total_spent', label: 'Total spent' },
  { field: 'orders_count', label: 'Orders count' },
  { field: 'default_address.country', label: 'Country' },
  { field: 'default_address.city', label: 'City' },
];

const PRODUCT_CATEGORIES = new Set(['product', 'cart']);

export function TriggerFilterBuilder({ eventId, filters, join, onChange }: TriggerFilterBuilderProps) {
  const event = eventId ? getEnhancedEventById(eventId) : undefined;
  const eventSource: TriggerFilter['source'] =
    event && PRODUCT_CATEGORIES.has(String(event.category)) ? 'product' : 'order';

  const eventFields = useMemo(
    () =>
      (event?.properties ?? []).map(p => ({
        field: p.name,
        label: p.description || p.name,
        source: eventSource,
      })),
    [event, eventSource],
  );

  const fieldKey = (f: TriggerFilter) => `${f.source}::${f.field}`;

  const updateRow = (index: number, patch: Partial<TriggerFilter>) => {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next, join);
  };
  const removeRow = (index: number) => onChange(filters.filter((_, i) => i !== index), join);
  const addRow = () => {
    const first = eventFields[0];
    onChange(
      [
        ...filters,
        first
          ? { source: first.source, field: first.field, operator: 'equals', value: '' }
          : { source: 'customer', field: 'email', operator: 'equals', value: '' },
      ],
      join,
    );
  };

  const selectClass =
    'rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20';

  return (
    <div className="space-y-2 rounded-lg border border-[#E8E4DE] bg-[#FAF9F6] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4A4139]">
          <Filter className="h-3.5 w-3.5 text-[#D4A574]" /> Filters
        </span>
        {filters.length > 1 && (
          <div className="flex items-center gap-1 text-[11px] text-[#8B7F76]">
            Match
            <select
              className={selectClass}
              value={join}
              onChange={e => onChange(filters, e.target.value as 'all' | 'any')}
            >
              <option value="all">ALL</option>
              <option value="any">ANY</option>
            </select>
          </div>
        )}
      </div>

      {filters.length === 0 ? (
        <p className="text-[11px] text-[#9B8E7E]">
          No filters — the journey enrolls on every matching event. Add a filter to qualify it
          (e.g. order value greater than 1000).
        </p>
      ) : (
        <div className="space-y-2">
          {filters.map((f, index) => {
            const op = OPERATORS.find(o => o.value === f.operator) ?? OPERATORS[0];
            return (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <select
                  className={selectClass}
                  value={fieldKey(f)}
                  onChange={e => {
                    const [source, ...rest] = e.target.value.split('::');
                    updateRow(index, { source: source as TriggerFilter['source'], field: rest.join('::') });
                  }}
                >
                  {eventFields.length > 0 && (
                    <optgroup label="Event properties">
                      {eventFields.map(ef => (
                        <option key={`${ef.source}::${ef.field}`} value={`${ef.source}::${ef.field}`}>
                          {ef.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Customer">
                    {CUSTOMER_FIELDS.map(cf => (
                      <option key={`customer::${cf.field}`} value={`customer::${cf.field}`}>
                        {cf.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <select
                  className={selectClass}
                  value={f.operator}
                  onChange={e => updateRow(index, { operator: e.target.value })}
                >
                  {OPERATORS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {op.needsValue && (
                  <input
                    className={`${selectClass} flex-1 min-w-[80px]`}
                    placeholder="value"
                    value={f.value ?? ''}
                    onChange={e => updateRow(index, { value: e.target.value })}
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove filter"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 rounded-lg border border-dashed border-[#E8E4DE] px-2 py-1.5 text-[11px] font-medium text-[#7D6248] hover:border-[#D4A574] hover:bg-[#F3EDE6]"
      >
        <Plus className="h-3.5 w-3.5" /> Add filter
      </button>
    </div>
  );
}
