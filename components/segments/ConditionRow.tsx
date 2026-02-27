'use client';

import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  SEGMENT_FIELD_OPTIONS,
  SEGMENT_OPERATORS,
  getFieldOptionsByGroup,
  type SegmentFieldType,
} from '@/lib/constants/segment-fields';

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

function getFieldType(field: string): SegmentFieldType {
  const meta = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  return meta?.type ?? 'text';
}

export default function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: ConditionValue;
  onChange: (next: ConditionValue) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(condition.field);
  const operators = SEGMENT_OPERATORS[fieldType] ?? SEGMENT_OPERATORS.text;
  const grouped = getFieldOptionsByGroup();

  const isNoValueOp =
    condition.operator === 'is_empty' ||
    condition.operator === 'is_not_empty' ||
    condition.operator === 'is_true' ||
    condition.operator === 'is_false';

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
      {/* Field selector with optgroup */}
      <select
        value={condition.field}
        onChange={(e) => {
          const nextField = e.target.value;
          const nextType = getFieldType(nextField);
          const defaultOp = SEGMENT_OPERATORS[nextType]?.[0]?.value ?? '';
          onChange({ ...condition, field: nextField, operator: defaultOp, value: '' });
        }}
        className="px-3 py-2 border rounded-lg text-sm"
      >
        {Object.entries(grouped).map(([group, fields]) => (
          <optgroup key={group} label={group}>
            {fields.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className="px-3 py-2 border rounded-lg text-sm"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input — conditional based on field type */}
      {isNoValueOp ? null : fieldType === 'boolean' ? null : fieldType === 'number' && condition.operator === 'between' ? (
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
      ) : fieldType === 'number' ? (
        <Input
          type="number"
          value={typeof condition.value === 'number' ? condition.value : Number(condition.value ?? 0)}
          onChange={event => onChange({ ...condition, value: Number(event.target.value) })}
          className="w-40"
        />
      ) : fieldType === 'date' ? (
        <Input
          type={condition.operator === 'in_last_days' ? 'number' : 'date'}
          placeholder={condition.operator === 'in_last_days' ? 'Days' : ''}
          value={typeof condition.value === 'string' ? condition.value : String(condition.value ?? '')}
          onChange={event =>
            onChange({
              ...condition,
              value: condition.operator === 'in_last_days' ? Number(event.target.value) : event.target.value,
            })
          }
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
