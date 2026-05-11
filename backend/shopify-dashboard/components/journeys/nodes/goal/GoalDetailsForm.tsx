"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GoalConfig } from "@/lib/types/goal-config";

const CATEGORY_OPTIONS: Array<GoalConfig["goalCategory"]> = ["conversion", "engagement", "revenue", "retention"];

interface GoalDetailsFormProps {
  value: GoalConfig;
  onChange: (config: GoalConfig) => void;
  disabled?: boolean;
}

export function GoalDetailsForm({ value, onChange, disabled = false }: GoalDetailsFormProps) {
  const requiresEventName = useMemo(
    () => value.goalType === "shopify_event" || value.goalType === "whatsapp_engagement" || value.goalType === "custom_event",
    [value.goalType],
  );
  const requiresSegment = useMemo(() => value.goalType === "segment_entry", [value.goalType]);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Goal name</Label>
          <Input
            placeholder="e.g. Complete Checkout"
            value={value.goalName}
            onChange={event => onChange({ ...value, goalName: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Goal category</Label>
          <Select
            value={value.goalCategory}
            onValueChange={goalCategory => onChange({ ...value, goalCategory: goalCategory as GoalConfig["goalCategory"] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(option => (
                <SelectItem key={option} value={option}>
                  {option.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Goal value (optional)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 1000"
            value={value.goalValue ?? ""}
            onChange={event =>
              onChange({
                ...value,
                goalValue: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Metric / event name</Label>
          <Input
            placeholder={requiresEventName ? "e.g. order_placed" : requiresSegment ? "Segment ID" : "Optional"}
            value={
              requiresSegment ? value.segmentId ?? "" : requiresEventName ? value.eventName ?? "" : value.eventName ?? ""
            }
            onChange={event => {
              if (requiresSegment) {
                onChange({ ...value, segmentId: event.target.value });
              } else if (requiresEventName) {
                onChange({ ...value, eventName: event.target.value });
              } else {
                onChange({ ...value, eventName: event.target.value });
              }
            }}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Goal description</Label>
        <Textarea
          placeholder="Describe what success looks like for this goal."
          value={value.goalDescription ?? ""}
          onChange={event => onChange({ ...value, goalDescription: event.target.value })}
          className="min-h-[90px]"
          disabled={disabled}
        />
      </div>
    </section>
  );
}



