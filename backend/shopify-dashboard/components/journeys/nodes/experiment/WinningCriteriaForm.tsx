"use client";

import { useMemo } from "react";
import { AlertCircle, CalendarClock, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { Variant, WinningCriteria } from "@/lib/types/experiment-config";

interface WinningCriteriaFormProps {
  criteria: WinningCriteria;
  onChange: (criteria: WinningCriteria) => void;
  variants: Variant[];
}

const SIGNIFICANCE_OPTIONS = [
  { value: 0.9, label: "90%" },
  { value: 0.95, label: "95%" },
  { value: 0.99, label: "99%" },
];

export function WinningCriteriaForm({ criteria, onChange, variants }: WinningCriteriaFormProps) {
  const nonControlVariants = useMemo(() => variants.filter(variant => !variant.isControl), [variants]);

  const handleMinimumRuntimeChange = (value: number) => {
    const runtime = Math.max(1, value);
    onChange({
      ...criteria,
      minimumRuntime: { ...criteria.minimumRuntime, value: runtime },
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-[#F0FDF4] bg-[#ECFDF5] p-5">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#047857]">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#14532D]">Winning criteria</p>
          <p className="text-xs text-[#166534]">
            Decide how a winner is determined and what should happen after the test ends.
          </p>
        </div>
      </header>

      <div className="space-y-3 rounded-2xl border border-[#BBF7D0] bg-white px-4 py-3">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#166534]">Winner selection</Label>
        <RadioGroup
          value={criteria.strategy}
          onValueChange={strategy => onChange({ ...criteria, strategy: strategy as WinningCriteria["strategy"] })}
          className="grid gap-3 md:grid-cols-2"
        >
          <label
            htmlFor="winning-strategy-automatic"
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 text-sm",
              criteria.strategy === "automatic" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-white",
            )}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem id="winning-strategy-automatic" value="automatic" />
              <div>
                <p className="font-semibold text-[#14532D]">Automatic</p>
                <p className="text-xs text-[#166534]">Declare a winner automatically once statistical criteria are met.</p>
              </div>
            </div>
          </label>
          <label
            htmlFor="winning-strategy-manual"
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 text-sm",
              criteria.strategy === "manual" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-white",
            )}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem id="winning-strategy-manual" value="manual" />
              <div>
                <p className="font-semibold text-[#14532D]">Manual</p>
                <p className="text-xs text-[#166534]">Review results and declare a winner manually.</p>
              </div>
            </div>
          </label>
        </RadioGroup>
      </div>

      {criteria.strategy === "automatic" ? (
        <div className="space-y-4 rounded-2xl border border-[#BBF7D0] bg-white px-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#166534]">Statistical significance</Label>
            <Select
              value={criteria.statisticalSignificance.toString()}
              onValueChange={value => onChange({ ...criteria, statisticalSignificance: Number(value) })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNIFICANCE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#166534]">
              <Label>Minimum lift required</Label>
              <span>{(criteria.minimumLift * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.round(criteria.minimumLift * 100)}
              onChange={event => onChange({ ...criteria, minimumLift: Number(event.target.value) / 100 })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#166534]">Minimum runtime</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={criteria.minimumRuntime.value}
                onChange={event => handleMinimumRuntimeChange(Number(event.target.value))}
              />
              <Select
                value={criteria.minimumRuntime.unit}
                onValueChange={unit =>
                  onChange({
                    ...criteria,
                    minimumRuntime: { ...criteria.minimumRuntime, unit: unit as WinningCriteria["minimumRuntime"]["unit"] },
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">hours</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="weeks">weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-[#FFE4E6] bg-[#FFF1F2] px-4 py-4">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#BE123C]">Post-test action</Label>
        <RadioGroup
          value={criteria.postTestAction}
          onValueChange={value => onChange({ ...criteria, postTestAction: value as WinningCriteria["postTestAction"] })}
          className="space-y-2"
        >
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#FECACA] px-3 py-2 text-sm text-[#BE123C]">
            <RadioGroupItem value="send_all_to_winner" />
            <span>Send all future traffic to winning variant</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#FECACA] px-3 py-2 text-sm text-[#BE123C]">
            <RadioGroupItem value="send_all_to_specific" />
            <span>Send all traffic to a specific variant</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#FECACA] px-3 py-2 text-sm text-[#BE123C]">
            <RadioGroupItem value="continue_split" />
            <span>Continue splitting traffic evenly</span>
          </label>
        </RadioGroup>

        {criteria.postTestAction === "send_all_to_specific" ? (
          <div className="space-y-2 rounded-xl border border-[#FECACA] bg-white px-3 py-2">
            <Label>Select variant</Label>
            <Select
              value={criteria.specificVariantId ?? ""}
              onValueChange={value => onChange({ ...criteria, specificVariantId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose variant" />
              </SelectTrigger>
              <SelectContent>
                {variants.map(variant => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {variant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border border-[#FECACA] bg-white px-3 py-2 text-xs text-[#BE123C]">
          <div className="flex items-center gap-2">
            <Switch
              checked={criteria.removeLosingPaths}
              onCheckedChange={checked => onChange({ ...criteria, removeLosingPaths: checked })}
            />
            Remove losing paths after winner declared
          </div>
          <Badge variant="secondary" className="bg-[#FFE4E6] text-[#BE123C]">
            Recommended
          </Badge>
        </div>
      </div>

      {criteria.strategy === "manual" && nonControlVariants.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          Add at least one non-control variant to continue.
        </div>
      ) : null}
    </section>
  );
}



