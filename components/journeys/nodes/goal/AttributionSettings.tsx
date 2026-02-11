"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { GoalConfig } from "@/lib/types/goal-config";
import { DurationPicker } from "../delay/DurationPicker";

interface AttributionSettingsProps {
  value: GoalConfig;
  onChange: (config: GoalConfig) => void;
  disabled?: boolean;
}

const ATTRIBUTION_MODELS: Array<GoalConfig["attributionModel"]> = ["first_touch", "last_touch", "linear"];

export function AttributionSettings({ value, onChange, disabled = false }: AttributionSettingsProps) {
  const windowValue = useMemo(
    () => value.attributionWindow ?? { value: 7, unit: "days" as const },
    [value.attributionWindow],
  );

  return (
    <section className="space-y-5">
      <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Attribution window</Label>
        <DurationPicker
          value={windowValue}
          onChange={duration =>
            onChange({
              ...value,
              attributionWindow: {
                value: duration.value,
                unit: duration.unit === "weeks" ? "days" : duration.unit === "minutes" ? "hours" : duration.unit as "hours" | "days",
              },
            })
          }
          allowedUnits={["hours", "days"]}
          minValue={1}
          label="Conversions counted within"
          disabled={disabled}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">Attribution model</p>
        <RadioGroup
          value={value.attributionModel}
          onValueChange={attributionModel => onChange({ ...value, attributionModel: attributionModel as GoalConfig["attributionModel"] })}
          className="grid gap-2 md:grid-cols-3"
          disabled={disabled}
        >
          {ATTRIBUTION_MODELS.map(model => (
            <label
              key={model}
              htmlFor={`goal-attribution-${model}`}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B]"
            >
              <RadioGroupItem id={`goal-attribution-${model}`} value={model} disabled={disabled} />
              {model.replace("_", " ")}
            </label>
          ))}
        </RadioGroup>
        <p className="text-[11px] text-[#64748B]">
          Choose how conversions are attributed when multiple messages touch the customer.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Count multiple conversions per user</p>
          <p className="text-xs text-[#64748B]">
            Enable if you want to count repeat conversions from the same user within the attribution window.
          </p>
        </div>
        <Switch
          checked={value.countMultipleConversions}
          onCheckedChange={checked => onChange({ ...value, countMultipleConversions: checked })}
          disabled={disabled}
        />
      </div>
    </section>
  );
}



