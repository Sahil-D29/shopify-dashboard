"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DurationUnit, DurationValue } from "@/lib/types/trigger-config";
import { cn } from "@/lib/utils";

const DEFAULT_UNITS: DurationUnit[] = ["minutes", "hours", "days", "weeks"];

interface DurationPickerProps {
  id?: string;
  label?: string;
  description?: string;
  value?: DurationValue | null;
  onChange: (value: DurationValue | null) => void;
  minAmount?: number;
  units?: DurationUnit[];
  allowZero?: boolean;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

const UNIT_LABELS: Record<DurationUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
};

export function DurationPicker({
  id,
  label,
  description,
  value,
  onChange,
  minAmount = 0,
  units = DEFAULT_UNITS,
  allowZero = false,
  allowEmpty = false,
  disabled = false,
  className,
  required,
}: DurationPickerProps) {
  const resolvedValue: DurationValue = useMemo(() => {
    if (value && typeof value.amount === "number" && value.unit) {
      return value;
    }
    return { amount: Math.max(minAmount, allowZero ? 0 : Math.max(1, minAmount)), unit: units[0] ?? "hours" };
  }, [allowZero, minAmount, units, value]);

  const handleAmountChange = (amount: number | null) => {
    if (amount == null || Number.isNaN(amount)) {
      if (allowEmpty) {
        onChange(null);
        return;
      }
      amount = allowZero ? 0 : Math.max(minAmount, 1);
    }
    const nextAmount = allowZero ? Math.max(0, amount) : Math.max(minAmount, amount);
    onChange({ ...resolvedValue, amount: nextAmount });
  };

  const handleUnitChange = (unit: DurationUnit) => {
    onChange({ ...resolvedValue, unit });
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium text-[#4A4139]">
          {label}
          {required ? <span className="ml-1 text-[#C8553D]">*</span> : null}
        </Label>
      ) : null}
      {description ? <p className="text-xs text-[#8B7F76]">{description}</p> : null}
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          min={allowZero ? 0 : minAmount || 1}
          step="1"
          value={value?.amount ?? resolvedValue.amount ?? ""}
          onChange={event => handleAmountChange(event.target.value === "" ? null : Number(event.target.value))}
          disabled={disabled}
          className="w-28"
        />
        <select
          className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20 disabled:cursor-not-allowed disabled:bg-[#F5F3EE]"
          value={value?.unit ?? resolvedValue.unit}
          onChange={event => handleUnitChange(event.target.value as DurationUnit)}
          disabled={disabled}
        >
          {units.map(unit => (
            <option key={unit} value={unit}>
              {UNIT_LABELS[unit]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default DurationPicker;


