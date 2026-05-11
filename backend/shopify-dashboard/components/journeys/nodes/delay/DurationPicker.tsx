"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { Duration } from "@/lib/types/delay-config";

interface DurationPickerProps {
  value: Duration;
  onChange: (duration: Duration) => void;
  label?: string;
  minValue?: number;
  maxValue?: number;
  allowedUnits?: Duration["unit"][];
  disabled?: boolean;
  className?: string;
}

const UNIT_LABELS: Record<Duration["unit"], string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
};

const PRESETS: Duration[] = [
  { value: 15, unit: "minutes" },
  { value: 30, unit: "minutes" },
  { value: 1, unit: "hours" },
  { value: 6, unit: "hours" },
  { value: 1, unit: "days" },
  { value: 3, unit: "days" },
  { value: 1, unit: "weeks" },
];

function normaliseValue(value: number, minValue?: number, maxValue?: number) {
  let next = Number.isFinite(value) ? value : 1;
  if (minValue != null) {
    next = Math.max(minValue, next);
  }
  if (maxValue != null) {
    next = Math.min(maxValue, next);
  }
  return next;
}

function formatDuration(duration: Duration): string {
  const base = UNIT_LABELS[duration.unit] ?? duration.unit;
  const label = duration.value === 1 ? base.replace(/s$/, "") : base;
  return `${duration.value} ${label.toLowerCase()}`;
}

function convertToMinutes(duration: Duration): number {
  switch (duration.unit) {
    case "minutes":
      return duration.value;
    case "hours":
      return duration.value * 60;
    case "days":
      return duration.value * 60 * 24;
    case "weeks":
      return duration.value * 60 * 24 * 7;
    default:
      return duration.value;
  }
}

export function DurationPicker({
  value,
  onChange,
  label,
  minValue = 1,
  maxValue,
  allowedUnits,
  disabled = false,
  className,
}: DurationPickerProps) {
  const [internal, setInternal] = useState<Duration>(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    onChange(internal);
  }, [internal, onChange]);

  const nextUnitSuggestion = useMemo(() => {
    const minutes = convertToMinutes(internal);
    if (minutes >= 60 * 24 * 7 && internal.unit !== "weeks") return "weeks";
    if (minutes >= 60 * 24 && internal.unit === "hours") return "days";
    if (minutes >= 60 && internal.unit === "minutes") return "hours";
    return null;
  }, [internal]);

  const conversionPreview = useMemo(() => {
    const minutes = convertToMinutes(internal);
    if (internal.unit === "minutes") {
      return `${internal.value} minutes = ${(minutes / 60).toFixed(2)} hours`;
    }
    if (internal.unit === "hours") {
      return `${internal.value} hours = ${(minutes / 60 / 24).toFixed(2)} days`;
    }
    if (internal.unit === "days") {
      return `${internal.value} days = ${(minutes / 60 / 24).toFixed(0)} days`;
    }
    return `${internal.value} weeks = ${(minutes / 60 / 24).toFixed(0)} days`;
  }, [internal]);

  const unitOptions = allowedUnits ?? (Object.keys(UNIT_LABELS) as Duration["unit"][]);

  return (
    <div className={cn("space-y-4", className)}>
      {label ? <p className="text-sm font-semibold text-[#1E293B]">{label}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          min={minValue}
          max={maxValue}
          value={internal.value}
          disabled={disabled}
          onChange={event => {
            const next = normaliseValue(Number(event.target.value), minValue, maxValue);
            setInternal(prev => ({ ...prev, value: next }));
          }}
          className="w-28"
        />
        <Select
          value={internal.unit}
          onValueChange={unit => setInternal(prev => ({ ...prev, unit: unit as Duration["unit"] }))}
          disabled={disabled}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map(unit => (
              <SelectItem key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.filter(preset => unitOptions.includes(preset.unit)).map(preset => (
          <Button
            key={`${preset.value}-${preset.unit}`}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="border-[#E2E8F0] text-[#1E293B] hover:bg-[#E2E8F0]/40"
            onClick={() => setInternal(preset)}
          >
            {formatDuration(preset)}
          </Button>
        ))}
      </div>

      <div className="space-y-1 text-xs text-[#64748B]">
        <p>
          Users will wait for <span className="font-semibold text-[#1E293B]">{formatDuration(internal)}</span> before
          continuing.
        </p>
        <p>{conversionPreview}</p>
        {nextUnitSuggestion ? (
          <p className="text-[#2563EB]">
            Tip: consider switching to {UNIT_LABELS[nextUnitSuggestion as Duration["unit"]]} for easier readability.
          </p>
        ) : null}
      </div>
    </div>
  );
}
