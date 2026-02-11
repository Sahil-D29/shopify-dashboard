"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { HolidaySettings } from "@/lib/types/delay-config";

interface HolidaySettingsConfigProps {
  value: HolidaySettings;
  onChange: (settings: HolidaySettings) => void;
  disabled?: boolean;
}

const CALENDAR_OPTIONS: Array<{ value: HolidaySettings["holidayCalendar"]; label: string }> = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "custom", label: "Custom calendar" },
];

const PRESET_HOLIDAYS: Record<Exclude<NonNullable<HolidaySettings["holidayCalendar"]>, "custom">, Array<{ date: string; label: string }>> = {
  us: [
    { date: "2025-01-01", label: "New Year’s Day" },
    { date: "2025-07-04", label: "Independence Day" },
    { date: "2025-11-27", label: "Thanksgiving" },
    { date: "2025-12-25", label: "Christmas Day" },
  ],
  uk: [
    { date: "2025-01-01", label: "New Year’s Day" },
    { date: "2025-04-18", label: "Good Friday" },
    { date: "2025-05-05", label: "Early May Bank Holiday" },
    { date: "2025-12-25", label: "Christmas Day" },
  ],
};

export function HolidaySettingsConfig({ value, onChange, disabled = false }: HolidaySettingsConfigProps) {
  const [customDateInput, setCustomDateInput] = useState("");

  const upcomingHolidays = useMemo(() => {
    if (!value.skipHolidays) return [];
    if (value.holidayCalendar === "custom") {
      return (value.customHolidayDates ?? []).map(date => ({ date, label: "Custom holiday" }));
    }
    const preset = value.holidayCalendar ? PRESET_HOLIDAYS[value.holidayCalendar] : [];
    return preset ?? [];
  }, [value.skipHolidays, value.holidayCalendar, value.customHolidayDates]);

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={value.skipWeekends}
          onCheckedChange={checked => onChange({ ...value, skipWeekends: Boolean(checked) })}
          disabled={disabled}
        />
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Skip weekends</p>
          <p className="text-xs text-[#64748B]">Delay will pause on Saturdays and Sundays, resuming the next business day.</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          checked={value.skipHolidays}
          onCheckedChange={checked =>
            onChange({
              ...value,
              skipHolidays: Boolean(checked),
              holidayCalendar: value.holidayCalendar ?? "us",
            })
          }
          disabled={disabled}
        />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">Skip public holidays</p>
            <p className="text-xs text-[#64748B]">Keep customers out of quiet periods during major holidays or your custom list.</p>
          </div>

          {value.skipHolidays ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Holiday calendar</Label>
                <Select
                  value={value.holidayCalendar ?? "us"}
                  onValueChange={holidayCalendar =>
                    onChange({
                      ...value,
                      holidayCalendar: holidayCalendar as HolidaySettings["holidayCalendar"],
                      customHolidayDates: holidayCalendar === "custom" ? value.customHolidayDates ?? [] : undefined,
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value ?? "us"}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {value.holidayCalendar === "custom" ? (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Custom holiday dates</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={customDateInput}
                      onChange={event => setCustomDateInput(event.target.value)}
                      disabled={disabled}
                      className="w-48"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!customDateInput) return;
                        const dates = new Set(value.customHolidayDates ?? []);
                        dates.add(customDateInput);
                        onChange({
                          ...value,
                          customHolidayDates: Array.from(dates).sort(),
                        });
                        setCustomDateInput("");
                      }}
                      disabled={disabled || !customDateInput}
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Add date
                    </Button>
                  </div>

                  {(value.customHolidayDates ?? []).length ? (
                    <ul className="space-y-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
                      {value.customHolidayDates?.map(date => (
                        <li key={date} className="flex items-center justify-between">
                          <span>{new Date(date).toLocaleDateString()}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onChange({
                                ...value,
                                customHolidayDates: (value.customHolidayDates ?? []).filter(item => item !== date),
                              })
                            }
                            disabled={disabled}
                            className="text-[#9CA3AF] hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#6B7280]">
                      Add important dates such as regional holidays, company events, or planned maintenance windows.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 text-xs text-[#475569]">
                <p className="font-semibold text-[#1F2937]">Upcoming holidays</p>
                {upcomingHolidays.length ? (
                  <ul className="space-y-1">
                    {upcomingHolidays.map(holiday => (
                      <li key={`${holiday.date}-${holiday.label}`}>
                        {new Date(holiday.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {holiday.label ? ` • ${holiday.label}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No holidays configured.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}



