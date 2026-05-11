"use client";

import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { OperatorType, PropertyDefinition, PropertyType } from "@/lib/types/condition-config";

interface ValueInputProps {
  property?: PropertyDefinition | null;
  operator?: OperatorType;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

const booleanOptions = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];

const orderStatusOptions = ["pending", "paid", "fulfilled", "partially_fulfilled", "cancelled", "refunded"];

function isBetween(operator?: OperatorType) {
  return operator === "between";
}

function usesList(operator?: OperatorType) {
  return operator === "in_list" || operator === "not_in_list";
}

function isPresenceOperator(operator?: OperatorType) {
  return operator === "is_set" || operator === "is_not_set";
}

function isBooleanProperty(type?: PropertyType, property?: PropertyDefinition | null) {
  if (type === "boolean") return true;
  if (!property) return false;
  return property.availableOperators?.length === 1 && property.availableOperators[0] === "equals";
}

function parseListInput(input: string) {
  return input
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export function ValueInput({ property, operator, value, onChange, disabled = false }: ValueInputProps) {
  if (!property || !operator || isPresenceOperator(operator)) {
    return null;
  }

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>, index?: number) => {
    const parsed = event.target.value === "" ? "" : Number(event.target.value);
    if (Number.isNaN(parsed) && parsed !== "") return;
    if (isBetween(operator) && typeof index === "number") {
      const next = Array.isArray(value) ? [...value] : ["", ""];
      next[index] = parsed;
      onChange(next);
    } else {
      onChange(parsed);
    }
  };

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>, index?: number) => {
    const nextValue = event.target.value;
    if (isBetween(operator) && typeof index === "number") {
      const next = Array.isArray(value) ? [...value] : ["", ""];
      next[index] = nextValue;
      onChange(next);
    } else {
      onChange(nextValue);
    }
  };

  if (isBooleanProperty(property.type, property)) {
    const boolValue = value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : "";
    return (
      <Select
        disabled={disabled}
        value={boolValue}
        onValueChange={next => onChange(next === "true")}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select true or false" />
        </SelectTrigger>
        <SelectContent>
          {booleanOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (property.id === "order.status" || property.id === "order_status") {
    return (
      <Select disabled={disabled} value={value ?? ""} onValueChange={next => onChange(next)}>
        <SelectTrigger>
          <SelectValue placeholder="Select order status" />
        </SelectTrigger>
        <SelectContent>
          {orderStatusOptions.map(option => (
            <SelectItem key={option} value={option}>
              {option.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (property.type === "number") {
    if (isBetween(operator)) {
      const [min, max] = Array.isArray(value) ? value : ["", ""];
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={min ?? ""}
            disabled={disabled}
            onChange={event => handleNumberChange(event, 0)}
          />
          <span className="text-sm text-[#8B7F76]">and</span>
          <Input
            type="number"
            placeholder="Max"
            value={max ?? ""}
            disabled={disabled}
            onChange={event => handleNumberChange(event, 1)}
          />
        </div>
      );
    }

    return (
      <Input
        type="number"
        placeholder="Enter value..."
        value={value ?? ""}
        disabled={disabled}
        onChange={handleNumberChange}
      />
    );
  }

  if (property.type === "date") {
    if (isBetween(operator)) {
      const [start, end] = Array.isArray(value) ? value : ["", ""];
      return (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={start ?? ""}
            disabled={disabled}
            onChange={event => handleDateChange(event, 0)}
          />
          <span className="text-sm text-[#8B7F76]">and</span>
          <Input
            type="date"
            value={end ?? ""}
            disabled={disabled}
            onChange={event => handleDateChange(event, 1)}
          />
        </div>
      );
    }

    return (
      <Input
        type="date"
        value={value ?? ""}
        disabled={disabled}
        onChange={handleDateChange}
      />
    );
  }

  if (usesList(operator)) {
    const listValue = Array.isArray(value) ? value.join(", ") : value ?? "";
    return (
      <Textarea
        placeholder="Enter comma-separated values..."
        value={listValue}
        disabled={disabled}
        onChange={event => onChange(parseListInput(event.target.value))}
        className="min-h-[72px]"
      />
    );
  }

  if (operator === "contains" || operator === "not_contains") {
    return (
      <Input
        type="text"
        placeholder="Enter value..."
        value={value ?? ""}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      type="text"
      placeholder="Enter value..."
      value={value ?? ""}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
    />
  );
}



