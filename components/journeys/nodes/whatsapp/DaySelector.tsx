"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DaySelectorProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

const DAYS = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
];

export function DaySelector({ selectedDays, onChange, disabled }: DaySelectorProps) {
  const toggleDay = (dayValue: number) => {
    if (disabled) return;

    const isSelected = selectedDays.includes(dayValue);
    const newDays = isSelected
      ? selectedDays.filter(d => d !== dayValue)
      : [...selectedDays, dayValue].sort((a, b) => a - b);
    
    onChange(newDays);
  };

  const selectAll = () => {
    if (disabled) return;
    onChange([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    if (disabled) return;
    onChange([1, 2, 3, 4, 5]); // Mon-Fri
  };

  const selectWeekends = () => {
    if (disabled) return;
    onChange([0, 6]); // Sun, Sat
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="space-y-3">
      {/* Quick selection buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={selectAll}
          disabled={disabled}
          className="text-xs"
        >
          All Days
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={selectWeekdays}
          disabled={disabled}
          className="text-xs"
        >
          Weekdays
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={selectWeekends}
          disabled={disabled}
          className="text-xs"
        >
          Weekends
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearAll}
          disabled={disabled}
          className="text-xs"
        >
          Clear
        </Button>
      </div>

      {/* Day buttons */}
      <div className="flex gap-2 flex-wrap">
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.value);
          
          return (
            <Button
              key={day.value}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day.value)}
              disabled={disabled}
              className={cn(
                "min-w-[60px] transition-all",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {day.label}
            </Button>
          );
        })}
      </div>

      {/* Warning when no days selected */}
      {selectedDays.length === 0 && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            ⚠️ No days selected - messages will not be sent
          </AlertDescription>
        </Alert>
      )}

      {/* Selected days preview */}
      {selectedDays.length > 0 && (
        <p className="text-xs text-gray-600">
          {selectedDays.length === 7 && "Messages will send every day"}
          {selectedDays.length < 7 && (
            <>
              Messages will send on:{" "}
              {selectedDays
                .map(d => DAYS.find(day => day.value === d)?.fullLabel)
                .join(", ")}
            </>
          )}
        </p>
      )}
    </div>
  );
}

