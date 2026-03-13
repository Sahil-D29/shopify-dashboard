'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SEGMENT_FIELD_OPTIONS,
  SEGMENT_OPERATORS,
  type SegmentFieldType,
  type EntityType,
} from '@/lib/constants/segment-fields';
import { FieldSelect } from './FieldSelect';
import { ProductSelect } from '@/components/selectors/ProductSelect';
import { CampaignSelect } from '@/components/selectors/CampaignSelect';
import { TemplateSelect } from '@/components/selectors/TemplateSelect';
import { SegmentSelect } from '@/components/selectors/SegmentSelect';
import { JourneySelect } from '@/components/selectors/JourneySelect';

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

function getFieldEntityType(field: string): EntityType | undefined {
  const meta = SEGMENT_FIELD_OPTIONS.find(f => f.value === field);
  return meta?.entityType;
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

  const isNoValueOp =
    condition.operator === 'is_empty' ||
    condition.operator === 'is_not_empty' ||
    condition.operator === 'is_true' ||
    condition.operator === 'is_false';

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
      {/* Field selector — searchable popover */}
      <FieldSelect
        value={condition.field}
        onValueChange={(nextField) => {
          const nextType = getFieldType(nextField);
          const defaultOp = SEGMENT_OPERATORS[nextType]?.[0]?.value ?? '';
          onChange({ ...condition, field: nextField, operator: defaultOp, value: '' });
        }}
        className="w-[200px]"
      />

      {/* Operator selector — styled Select */}
      <Select
        value={condition.operator}
        onValueChange={(op) => onChange({ ...condition, operator: op })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                  className="w-24"
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
                  className="w-24"
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
          className="w-32"
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
          className="w-40"
        />
      ) : (() => {
        const entityType = getFieldEntityType(condition.field);
        const strValue = typeof condition.value === 'string' ? condition.value : '';
        if (entityType === 'product') {
          return <ProductSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
        }
        if (entityType === 'campaign') {
          return <CampaignSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
        }
        if (entityType === 'template') {
          return <TemplateSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
        }
        if (entityType === 'journey') {
          return <JourneySelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
        }
        if (entityType === 'segment') {
          return <SegmentSelect value={strValue} onValueChange={(val) => onChange({ ...condition, value: val })} className="w-56" />;
        }
        return (
          <Input
            type="text"
            value={strValue}
            onChange={event => onChange({ ...condition, value: event.target.value })}
            placeholder="Enter value..."
            className="w-56"
          />
        );
      })()}

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="ml-auto shrink-0 text-gray-400 hover:text-red-500"
        aria-label="Remove condition"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
