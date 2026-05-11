'use client';

import React, { useMemo } from 'react';
import { Trash2 } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { EventCondition, ConditionOperator } from '@/lib/types/trigger-config';
import type { ShopifyEventProperty } from '@/constants/shopifyEvents';
import { DynamicValueInput } from '@/components/journeys/nodes/trigger/DynamicValueInput';

interface PropertyConditionRowProps {
  condition: EventCondition;
  availableProperties: ShopifyEventProperty[];
  onUpdate: (updates: Partial<EventCondition>) => void;
  onRemove: () => void;
}

const OPERATORS_BY_TYPE: Record<
  string,
  Array<{
    value: ConditionOperator;
    label: string;
  }>
> = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_than_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_than_or_equal', label: '≤' },
  ],
  boolean: [
    { value: 'equals', label: 'is true' },
    { value: 'not_equals', label: 'is false' },
  ],
  date: [
    { value: 'less_than', label: 'before' },
    { value: 'greater_than', label: 'after' },
    { value: 'equals', label: 'on' },
  ],
};

export function PropertyConditionRow({
  condition,
  availableProperties,
  onUpdate,
  onRemove,
}: PropertyConditionRowProps) {
  const property = useMemo(
    () => availableProperties.find(item => item.name === condition.property),
    [availableProperties, condition.property],
  );
  const propertyType = property?.type ?? 'string';
  const operators = OPERATORS_BY_TYPE[propertyType] ?? OPERATORS_BY_TYPE.string;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex-1">
        <Select value={condition.property} onValueChange={value => onUpdate({ property: value })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {availableProperties.map(item => (
              <SelectItem key={item.name} value={item.name}>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-xs text-gray-500">{item.type}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        <Select value={condition.operator} onValueChange={value => onUpdate({ operator: value as ConditionOperator })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {operators.map(operator => (
              <SelectItem key={operator.value} value={operator.value}>
                {operator.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1">
        {!['exists', 'not_exists'].includes(condition.operator) ? (
          <DynamicValueInput
            propertyId={condition.property}
            operator={condition.operator}
            value={condition.value}
            onChange={(newValue) => {
              onUpdate({ value: newValue });
            }}
          />
        ) : (
          <div className="text-sm italic text-gray-500">No value required</div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
        title="Remove filter"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

