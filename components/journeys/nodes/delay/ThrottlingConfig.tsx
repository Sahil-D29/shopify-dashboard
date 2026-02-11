"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ThrottlingSettings } from "@/lib/types/delay-config";

interface ThrottlingConfigProps {
  value: ThrottlingSettings;
  onChange: (settings: ThrottlingSettings) => void;
  disabled?: boolean;
  estimatedAudience?: number;
}

export function ThrottlingConfig({ value, onChange, disabled = false, estimatedAudience }: ThrottlingConfigProps) {
  const maxHour = value.maxUsersPerHour ?? 0;
  const maxDay = value.maxUsersPerDay ?? 0;

  const estimatedImpact = useMemo(() => {
    if (!estimatedAudience || (!maxHour && !maxDay)) return null;
    const perHour = maxHour || (maxDay ? Math.ceil(maxDay / 24) : estimatedAudience);
    const perDay = maxDay || (maxHour ? Math.ceil(maxHour * 24) : estimatedAudience);
    const days = Math.max(1, Math.ceil(estimatedAudience / perDay));
    return { perHour, perDay, days };
  }, [estimatedAudience, maxHour, maxDay]);

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={value.enabled}
          onCheckedChange={checked =>
            onChange({
              enabled: Boolean(checked),
              maxUsersPerHour: value.maxUsersPerHour,
              maxUsersPerDay: value.maxUsersPerDay,
            })
          }
          disabled={disabled}
        />
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Throttle message throughput</p>
          <p className="text-xs text-[#64748B]">
            Limit how many users exit this delay each hour or day to avoid overwhelming downstream systems.
          </p>
        </div>
      </div>

      {value.enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Max users per hour</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 100"
              value={value.maxUsersPerHour ?? ""}
              onChange={event =>
                onChange({
                  ...value,
                  maxUsersPerHour: event.target.value ? Math.max(1, Number(event.target.value)) : undefined,
                })
              }
              disabled={disabled}
            />
            <p className="text-xs text-[#94A3B8]">Leave blank to allow unlimited hourly throughput.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Max users per day</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 1000"
              value={value.maxUsersPerDay ?? ""}
              onChange={event =>
                onChange({
                  ...value,
                  maxUsersPerDay: event.target.value ? Math.max(1, Number(event.target.value)) : undefined,
                })
              }
              disabled={disabled}
            />
            <p className="text-xs text-[#94A3B8]">Leave blank to allow unlimited daily throughput.</p>
          </div>
        </div>
      ) : null}

      {value.enabled ? (
        <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] px-4 py-3 text-xs text-[#4338CA]">
          <p>
            Throttling ensures predictable pacing but may extend the delay. If both limits are set, the stricter constraint
            applies first.
          </p>
          {estimatedImpact ? (
            <p className="mt-2 text-[#3730A3]">
              With an estimated audience of <strong>{estimatedAudience?.toLocaleString()}</strong> users and your limits
              ({estimatedImpact.perHour.toLocaleString()}/hour, {estimatedImpact.perDay.toLocaleString()}/day), the delay may last up to{" "}
              <strong>{estimatedImpact.days} day{estimatedImpact.days === 1 ? "" : "s"}</strong>.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}



