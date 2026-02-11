"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { OperatorType, PropertyDefinition } from "@/lib/types/condition-config";

const operatorLabels: Record<OperatorType, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  contains: "contains",
  not_contains: "does not contain",
  greater_than: "is greater than",
  less_than: "is less than",
  between: "is between",
  is_set: "is set",
  is_not_set: "is not set",
  starts_with: "starts with",
  ends_with: "ends with",
  in_list: "is in list",
  not_in_list: "is not in list",
};

export const defaultOperatorsByType: Record<string, OperatorType[]> = {
  string: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_set", "is_not_set"],
  number: ["equals", "not_equals", "greater_than", "less_than", "between", "is_set", "is_not_set"],
  boolean: ["equals", "is_set", "is_not_set"],
  date: ["equals", "greater_than", "less_than", "between", "is_set", "is_not_set"],
  array: ["contains", "not_contains", "in_list", "not_in_list", "is_set", "is_not_set"],
  object: ["is_set", "is_not_set"],
};

interface OperatorSelectorProps {
  property?: PropertyDefinition | null;
  operator?: OperatorType;
  onChange: (operator: OperatorType) => void;
  disabled?: boolean;
}

export function OperatorSelector({ property, operator, onChange, disabled = false }: OperatorSelectorProps) {
  const options = useMemo<OperatorType[]>(() => {
    if (!property) return [];
    if (property.availableOperators?.length) return property.availableOperators;
    return defaultOperatorsByType[property.type] ?? defaultOperatorsByType.string;
  }, [property]);

  if (!property) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Select a property first" />
        </SelectTrigger>
      </Select>
    );
  }

  const current = operator && options.includes(operator) ? operator : options[0];

  return (
    <Select
      value={current}
      onValueChange={value => onChange(value as OperatorType)}
      disabled={disabled || options.length === 0}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select operator" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {operatorLabels[option] ?? option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}



