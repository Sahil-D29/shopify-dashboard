"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { TimeOfDay } from "@/lib/types/delay-config";

interface TimePickerProps {
  value: TimeOfDay;
  onChange: (time: TimeOfDay) => void;
  format?: "12h" | "24h";
  timezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  allowTimezoneSelection?: boolean;
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}

const TIMEZONE_OPTIONS: Array<{ value: string; label: string; abbr: string }> = [
  { value: "customer", label: "Customer's local timezone", abbr: "Local" },
  { value: "UTC", label: "Coordinated Universal Time", abbr: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)", abbr: "ET" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", abbr: "PT" },
  { value: "Europe/London", label: "London (GMT)", abbr: "GMT" },
  { value: "Europe/Berlin", label: "Central Europe (CET)", abbr: "CET" },
  { value: "Asia/Kolkata", label: "India Standard Time", abbr: "IST" },
  { value: "Asia/Singapore", label: "Singapore Time", abbr: "SGT" },
  { value: "Australia/Sydney", label: "Australia (Sydney)", abbr: "AEST" },
];

function formatTimePreview(time: TimeOfDay, formatMode: "24h" | "12h"): string {
  const hour = time.hour;
  const minute = time.minute.toString().padStart(2, "0");
  if (formatMode === "24h") {
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function TimePicker({
  value,
  onChange,
  format = "24h",
  timezone = "customer",
  onTimezoneChange,
  allowTimezoneSelection = false,
  minuteStep = 15,
  disabled = false,
  className,
  label,
}: TimePickerProps) {
  const [internal, setInternal] = useState<TimeOfDay>(value);
  const [formatMode, setFormatMode] = useState<"24h" | "12h">(format);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    setFormatMode(format);
  }, [format]);

  useEffect(() => {
    onChange(internal);
  }, [internal, onChange]);

  const minuteOptions = useMemo(() => {
    const step = Math.max(1, minuteStep);
    return Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step).filter(min => min < 60);
  }, [minuteStep]);

  const timezoneOption = TIMEZONE_OPTIONS.find(option => option.value === timezone) ?? TIMEZONE_OPTIONS[0];
  const preview = useMemo(() => formatTimePreview(internal, formatMode), [internal, formatMode]);

  return (
    <div className={cn("space-y-4", className)}>
      {label ? <p className="text-sm font-semibold text-[#1E293B]">{label}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
          <Select
            value={internal.hour.toString()}
            disabled={disabled}
            onValueChange={hour => setInternal(prev => ({ ...prev, hour: Number(hour) }))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {Array.from({ length: 24 }, (_, hour) => (
                <SelectItem key={hour} value={hour.toString()}>
                  {hour.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-lg font-semibold text-[#334155]">:</span>
          <Select
            value={internal.minute.toString()}
            disabled={disabled}
            onValueChange={minute => setInternal(prev => ({ ...prev, minute: Number(minute) }))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {minuteOptions.map(min => (
                <SelectItem key={min} value={min.toString()}>
                  {min.toString().padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ToggleGroup
          type="single"
          value={formatMode}
          onValueChange={mode => mode && setFormatMode(mode as "24h" | "12h")}
          className="rounded-xl border border-[#E2E8F0] bg-white"
          disabled={disabled}
        >
          <ToggleGroupItem value="24h" className="px-3 py-1 text-xs font-semibold">
            24h
          </ToggleGroupItem>
          <ToggleGroupItem value="12h" className="px-3 py-1 text-xs font-semibold">
            12h
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {allowTimezoneSelection ? (
        <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Timezone</p>
          <Select
            value={timezone}
            disabled={disabled}
            onValueChange={tz => onTimezoneChange?.(tz)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {TIMEZONE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} {option.abbr ? `(${option.abbr})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#E2E8F0] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E293B]">
        <p>
          Next occurrence: <span className="font-semibold">{preview}</span>{" "}
          {timezone === "customer" ? "(customer local time)" : `(${timezoneOption.abbr})`}
        </p>
      </div>
    </div>
  );
}

