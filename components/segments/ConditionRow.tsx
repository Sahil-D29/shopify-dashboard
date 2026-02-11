'use client';

import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

type FieldOption = {
  value: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'tags';
};

const FIELD_OPTIONS: FieldOption[] = [
  { value: 'customer_name', label: 'Customer Name', type: 'text' },
  { value: 'customer_email', label: 'Email', type: 'text' },
  { value: 'customer_phone', label: 'Phone', type: 'text' },
  { value: 'customer_tags', label: 'Tags', type: 'tags' },
  { value: 'location_country', label: 'Country', type: 'text' },
  { value: 'location_city', label: 'City', type: 'text' },
  { value: 'location_state', label: 'State', type: 'text' },
  { value: 'total_orders', label: 'Total Orders', type: 'number' },
  { value: 'total_spent', label: 'Total Spent', type: 'number' },
  { value: 'average_order_value', label: 'Average Order Value', type: 'number' },
  { value: 'days_since_last_order', label: 'Days Since Last Order', type: 'number' },
];

const OPERATORS: Record<FieldOption['type'], { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'between', label: 'between' },
  ],
  date: [
    { value: 'in_last_days', label: 'in last X days' },
    { value: 'after_date', label: 'after date' },
    { value: 'before_date', label: 'before date' },
  ],
  tags: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
};

type NumberRange = [number, number];

export interface ConditionValue {
  id: string;
  field: string;
  operator: string;
  value: string | number | string[] | NumberRange;
}

const ensureNumberRange = (value: ConditionValue['value']): NumberRange => {
  if (Array.isArray(value)) {
    const [min, max] = value as Array<string | number | undefined>;
    return [Number(min ?? 0), Number(max ?? 0)];
  }
  return [0, 0];
};

export default function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: ConditionValue;
  onChange: (next: ConditionValue) => void;
  onRemove: () => void;
}) {
  const fieldMeta = FIELD_OPTIONS.find(f => f.value === condition.field) || FIELD_OPTIONS[0];
  const operators = OPERATORS[fieldMeta.type];

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
      <select
        value={condition.field}
        onChange={(e) => {
          const nextField = e.target.value;
          const fm = FIELD_OPTIONS.find(f => f.value === nextField) || FIELD_OPTIONS[0];
          onChange({ ...condition, field: nextField, operator: OPERATORS[fm.type][0].value, value: '' });
        }}
        className="px-3 py-2 border rounded-lg"
      >
        {FIELD_OPTIONS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className="px-3 py-2 border rounded-lg"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {fieldMeta.type === 'number' && condition.operator === 'between' ? (
        <div className="flex items-center gap-2">
          {(() => {
            const [minValue, maxValue] = ensureNumberRange(condition.value);
            return (
              <>
          <Input
            type="number"
            placeholder="Min"
            value={String(minValue)}
            onChange={event => {
              const min = Number(event.target.value || 0);
              onChange({ ...condition, value: [min, maxValue] });
            }}
            className="w-28"
          />
          <span className="text-sm text-gray-500">and</span>
          <Input
            type="number"
            placeholder="Max"
            value={String(maxValue)}
            onChange={event => {
              const max = Number(event.target.value || 0);
              onChange({ ...condition, value: [minValue, max] });
            }}
            className="w-28"
          />
              </>
            );
          })()}
        </div>
      ) : fieldMeta.type === 'number' ? (
        <Input
          type="number"
          value={typeof condition.value === 'number' ? condition.value : Number(condition.value ?? 0)}
          onChange={event => onChange({ ...condition, value: Number(event.target.value) })}
          className="w-40"
        />
      ) : fieldMeta.type === 'date' ? (
        <Input
          type="date"
          value={typeof condition.value === 'string' ? condition.value : ''}
          onChange={event => onChange({ ...condition, value: event.target.value })}
          className="w-52"
        />
      ) : (
        <Input
          type="text"
          value={typeof condition.value === 'string' ? condition.value : ''}
          onChange={event => onChange({ ...condition, value: event.target.value })}
          className="w-64"
        />
      )}

      <button onClick={onRemove} className="ml-auto p-2 rounded hover:bg-gray-100" aria-label="Remove condition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}


