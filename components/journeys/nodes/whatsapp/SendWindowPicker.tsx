"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DaySelector } from "./DaySelector";
import type { SendWindowConfig } from "@/lib/types/whatsapp-config";

const DAYS_OF_WEEK: Array<{ value: number; label: string; short: string }> = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "customer", label: "Customer's timezone" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Kolkata", label: "India Standard Time" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export interface SendWindowPickerProps {
  value: SendWindowConfig;
  onChange: (config: SendWindowConfig) => void;
  error?: string | null;
}

function ensureValidTimeRange(startTime: string, endTime: string): { start: string; end: string } {
  const defaultStart = "09:00";
  const defaultEnd = "21:00";
  const start = startTime || defaultStart;
  const end = endTime || defaultEnd;
  if (start >= end) {
    return { start, end: start > defaultEnd ? "23:59" : defaultEnd };
  }
  return { start, end };
}

function formatPreview(value: SendWindowConfig): string {
  if (!value.daysOfWeek.length) {
    return "No days selected. Messages will not be sent.";
  }
  const selectedLabels = value.daysOfWeek
    .sort((a, b) => a - b)
    .map(day => DAYS_OF_WEEK.find(item => item.value === day)?.short ?? day.toString())
    .join(", ");
  const timezoneLabel =
    value.timezone === "customer"
      ? "customer's local time"
      : TIMEZONE_OPTIONS.find(option => option.value === value.timezone)?.label ?? value.timezone;
  return `Messages will send ${selectedLabels} between ${value.startTime} and ${value.endTime} in ${timezoneLabel}.`;
}

export function SendWindowPicker({ value, onChange, error }: SendWindowPickerProps) {
  const { start: startTime, end: endTime } = useMemo(
    () => ensureValidTimeRange(value.startTime, value.endTime),
    [value.startTime, value.endTime],
  );

  const handleDaysChange = (days: number[]) => {
    onChange({
      ...value,
      daysOfWeek: days,
    });
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Send Settings</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Send Window</h3>
        <p className="text-sm text-[#8B7F76]">
          Control exactly when messages can be delivered. Respect quiet hours and local customer timezones.
        </p>
      </header>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Days of the week</Label>
        <DaySelector
          selectedDays={value.daysOfWeek}
          onChange={handleDaysChange}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Start time</Label>
          <Input
            type="time"
            value={startTime}
            onChange={event =>
              onChange({
                ...value,
                startTime: event.target.value || "00:00",
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">End time</Label>
          <Input
            type="time"
            value={endTime}
            onChange={event =>
              onChange({
                ...value,
                endTime: event.target.value || "23:59",
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Timezone</Label>
        <select
          className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139] focus:border-[#D4A574] focus:outline-none focus:ring-2 focus:ring-[#D4A574]/20"
          value={value.timezone}
          onChange={event =>
            onChange({
              ...value,
              timezone: event.target.value as SendWindowConfig["timezone"],
            })
          }
        >
          {TIMEZONE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className={cn(
          "rounded-2xl border px-4 py-3 text-sm",
          error ? "border-[#F1C8AD] bg-[#FEF3EF] text-[#9C613C]" : "border-[#E8E4DE] bg-[#FAF9F6] text-[#4A4139]",
        )}
      >
        {error ?? formatPreview({ ...value, startTime, endTime })}
      </div>
    </section>
  );
}



