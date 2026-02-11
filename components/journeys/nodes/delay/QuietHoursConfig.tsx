"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { QuietHours, TimeOfDay } from "@/lib/types/delay-config";
import { TimePicker } from "./TimePicker";

interface QuietHoursConfigProps {
  value: QuietHours;
  onChange: (settings: QuietHours) => void;
  disabled?: boolean;
}

const TIMEZONE_OPTIONS: Array<{ value: string; label: string; abbr: string }> = [
  { value: "customer", label: "Customer local time", abbr: "Local" },
  { value: "UTC", label: "Coordinated Universal Time", abbr: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)", abbr: "ET" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", abbr: "PT" },
  { value: "Europe/London", label: "London", abbr: "GMT" },
  { value: "Europe/Berlin", label: "Central Europe", abbr: "CET" },
  { value: "Asia/Kolkata", label: "India Standard Time", abbr: "IST" },
  { value: "Asia/Singapore", label: "Singapore", abbr: "SGT" },
  { value: "Australia/Sydney", label: "Sydney", abbr: "AEST" },
];

function minutesSinceMidnight(time: TimeOfDay): number {
  return time.hour * 60 + time.minute;
}

function formatTime(time: TimeOfDay): string {
  const hour12 = time.hour % 12 || 12;
  const suffix = time.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${time.minute.toString().padStart(2, "0")} ${suffix}`;
}

export function QuietHoursConfig({ value, onChange, disabled = false }: QuietHoursConfigProps) {
  const durationMinutes = useMemo(() => {
    const start = minutesSinceMidnight(value.startTime);
    const end = minutesSinceMidnight(value.endTime);
    const diff = end - start;
    return diff <= 0 ? 1440 + diff : diff;
  }, [value.startTime, value.endTime]);

  const spansMoreThanHalfDay = durationMinutes > 12 * 60;

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={value.enabled}
          onCheckedChange={checked => onChange({ ...value, enabled: Boolean(checked) })}
          disabled={disabled}
        />
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Block deliveries during quiet hours</p>
          <p className="text-xs text-[#64748B]">
            Avoid sending messages overnight or during low-engagement hours. Messages are deferred until the quiet window ends.
          </p>
        </div>
      </div>

      {value.enabled ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TimePicker
              label="Quiet hours start"
              value={value.startTime}
              onChange={time => onChange({ ...value, startTime: time })}
              timezone={value.timezone}
              disabled={disabled}
              minuteStep={15}
            />
            <TimePicker
              label="Quiet hours end"
              value={value.endTime}
              onChange={time => onChange({ ...value, endTime: time })}
              timezone={value.timezone}
              disabled={disabled}
              minuteStep={15}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Timezone</Label>
            <Select
              value={value.timezone}
              onValueChange={timezone => onChange({ ...value, timezone })}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMEZONE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} {option.abbr ? `(${option.abbr})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">Daily timeline</p>
            <div className="relative h-12 rounded-full bg-[#EFF6FF]">
              <div
                className="absolute inset-y-1 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] shadow-inner"
                style={{
                  left: `${(minutesSinceMidnight(value.startTime) / 1440) * 100}%`,
                  width: `${(durationMinutes / 1440) * 100}%`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-4 text-[11px] font-medium text-[#475569]">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
            <p className="text-xs text-[#64748B]">
              Quiet period from <strong>{formatTime(value.startTime)}</strong> to{" "}
              <strong>{formatTime(value.endTime)}</strong> ({value.timezone === "customer" ? "customer local time" : value.timezone}).
            </p>
            {spansMoreThanHalfDay ? (
              <p className="text-xs text-[#B45309]">
                Warning: Quiet hours cover more than 12 hours. This may significantly delay message delivery.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}


