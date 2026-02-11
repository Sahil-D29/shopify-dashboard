"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { GoalConfig } from "@/lib/types/goal-config";

interface ExitBehaviorFormProps {
  value: GoalConfig;
  onChange: (config: GoalConfig) => void;
  disabled?: boolean;
}

export function ExitBehaviorForm({ value, onChange, disabled = false }: ExitBehaviorFormProps) {
  return (
    <section className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">After goal is achieved</p>
        <RadioGroup
          value={value.exitAfterGoal ? "exit" : "continue"}
          onValueChange={selection => onChange({ ...value, exitAfterGoal: selection === "exit" })}
          className="space-y-2"
          disabled={disabled}
        >
          <label
            htmlFor="goal-exit"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#1E293B]"
          >
            <RadioGroupItem id="goal-exit" value="exit" disabled={disabled} />
            <span>
              Exit journey
              <span className="mt-1 block text-xs text-[#64748B]">
                Users who hit this goal will not receive further journey messages.
              </span>
            </span>
          </label>
          <label
            htmlFor="goal-continue"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#1E293B]"
          >
            <RadioGroupItem id="goal-continue" value="continue" disabled={disabled} />
            <span>
              Continue journey
              <span className="mt-1 block text-xs text-[#64748B]">
                Users continue to the next node, useful for secondary goals.
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4">
        <div>
          <Label className="text-sm font-semibold text-[#1E293B]">Mark journey as completed</Label>
          <p className="text-xs text-[#64748B]">
            When enabled, the journey will appear as completed for reporting once this goal is achieved.
          </p>
        </div>
        <Switch
          checked={value.markAsCompleted}
          onCheckedChange={checked => onChange({ ...value, markAsCompleted: checked })}
          disabled={disabled}
        />
      </div>
    </section>
  );
}



