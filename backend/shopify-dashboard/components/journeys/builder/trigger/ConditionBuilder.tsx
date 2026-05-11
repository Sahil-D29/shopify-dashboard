'use client';

import React from 'react';
import { Hash, ToggleLeft, Type, Calendar, Trash2, GripVertical } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EventCondition, ConditionOperator } from '@/lib/types/trigger-config';
import type { ShopifyEventProperty } from '@/constants/shopifyEvents';
import { OPERATORS, VALUE_INPUT_TYPE } from '@/components/journeys/builder/trigger/constants/operators';
import { DynamicValueInput } from '@/components/journeys/nodes/trigger/DynamicValueInput';

interface ConditionBuilderProps {
  condition: EventCondition;
  availableProperties: ShopifyEventProperty[];
  onUpdate: (condition: EventCondition) => void;
  onRemove: () => void;
  isDraggable?: boolean;
}

/** Displays a property/operator/value condition row for a trigger rule. */
export function ConditionBuilder({
  condition,
  availableProperties,
  onUpdate,
  onRemove,
  isDraggable = true,
}: ConditionBuilderProps) {
  const selectedProperty = availableProperties.find(property => property.name === condition.property);
  const propertyType = selectedProperty?.type ?? 'string';
  const operators = OPERATORS[propertyType] ?? OPERATORS.string;

  if (!availableProperties.length) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        <span>⚠️ No properties available for this rule yet. Select an event or configure properties before adding filters.</span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-3 rounded border border-yellow-300 px-3 py-1 text-xs font-semibold text-yellow-800 transition hover:bg-yellow-100"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-4 shadow-sm transition-colors hover:border-[#C7D2FE] hover:bg-[#EEF2FF] sm:flex-row sm:items-center">
      {isDraggable ? (
        <div className="hidden flex-shrink-0 cursor-grab text-gray-400 transition-colors group-hover:text-gray-600 sm:block">
          <GripVertical className="h-5 w-5" />
        </div>
      ) : null}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex-1 sm:w-auto sm:flex-initial">
          <Select
            value={condition.property}
            onValueChange={value => onUpdate({ ...condition, property: value })}
          >
            <SelectTrigger className="w-full min-w-0 bg-white">
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {availableProperties.map(property => (
                <SelectItem key={property.name} value={property.name}>
                  <div className="flex items-center gap-2">
                    {getPropertyIcon(property.type)}
                    <span className="truncate text-sm font-medium text-gray-800">{property.name}</span>
                    <span className="text-xs text-gray-400">({property.type})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 sm:w-auto sm:flex-initial">
          <Select
            value={condition.operator}
            onValueChange={value => onUpdate({ ...condition, operator: value as ConditionOperator })}
          >
            <SelectTrigger className="w-full min-w-0 bg-white">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {operators.map(operator => (
                <SelectItem key={operator.value} value={operator.value}>
                  {operator.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!['exists', 'not_exists'].includes(condition.operator) ? (
          <DynamicValueInput
            propertyId={condition.property}
            operator={condition.operator}
            value={condition.value}
            onChange={(newValue) => {
              onUpdate({
                ...condition,
                value: newValue,
              });
            }}
          />
        ) : (
          <div className="text-sm italic text-gray-500 sm:flex-1">No value required</div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-white text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 sm:h-9 sm:w-9 sm:rounded-full sm:border-none sm:bg-transparent sm:text-gray-400 sm:hover:bg-red-50 sm:hover:text-red-600"
        title="Remove condition"
      >
        <Trash2 className="h-4 w-4" />
        <span className="sm:hidden">Remove</span>
      </button>
    </div>
  );
}

const PROPERTY_ICONS: Record<ShopifyEventProperty['type'], React.ElementType> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
};

function getPropertyIcon(type: ShopifyEventProperty['type']) {
  const Icon = PROPERTY_ICONS[type] ?? Type;
  return <Icon className="h-4 w-4 text-gray-400" aria-hidden />;
}

