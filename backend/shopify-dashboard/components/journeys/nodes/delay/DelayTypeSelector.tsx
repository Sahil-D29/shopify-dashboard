"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { BadgeCheck, Bell, Clock, RefreshCcw, Sparkles, Timer } from "lucide-react";

import type { DelayType } from "@/lib/types/delay-config";

interface DelayTypeSelectorProps {
  value: DelayType;
  onChange: (type: DelayType) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: DelayType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  example: string;
  badge?: string;
}> = [
  {
    value: "fixed_time",
    title: "Fixed Time Delay",
    description: "Wait a specific amount of time before moving forward.",
    icon: Timer,
    example: "Example: Wait 2 hours before sending the next message.",
  },
  {
    value: "wait_until_time",
    title: "Wait Until Specific Time",
    description: "Hold users until the next occurrence of a chosen time.",
    icon: Clock,
    example: "Example: Send all users at 10:00 AM in their timezone.",
  },
  {
    value: "wait_for_event",
    title: "Wait For Event",
    description: "Resume when a user completes an event, with timeout controls.",
    icon: Bell,
    example: "Example: Wait until user places an order, otherwise branch after 3 days.",
  },
  {
    value: "optimal_send_time",
    title: "Optimal Send Time",
    description: "AI selects the best send time within a window.",
    icon: Sparkles,
    example: "Example: Deliver within 24h at the user’s peak engagement hour.",
    badge: "AI-powered",
  },
  {
    value: "wait_for_attribute",
    title: "Wait For Attribute",
    description: "Pause until a customer attribute matches a target value.",
    icon: RefreshCcw,
    example: "Example: Wait until order.status becomes “fulfilled”, else exit after 7 days.",
  },
];

export function DelayTypeSelector({ value, onChange, disabled = false }: DelayTypeSelectorProps) {
  return (
    <TooltipProvider>
      <RadioGroup
        value={value}
        onValueChange={next => onChange(next as DelayType)}
        className="grid gap-3 md:grid-cols-2"
        disabled={disabled}
      >
        {OPTIONS.map(option => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <label
                htmlFor={`delay-type-${option.value}`}
                className={cn(
                  "flex cursor-pointer flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition",
                  value === option.value
                    ? "border-[#3B82F6] bg-[#EFF6FF] shadow"
                    : "border-[#E2E8F0] bg-white hover:border-[#3B82F6]/50",
                  disabled && "pointer-events-none opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem id={`delay-type-${option.value}`} value={option.value} disabled={disabled} />
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B82F6]/10 text-[#1D4ED8]">
                    <option.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#1E293B]">{option.title}</p>
                      {option.badge ? (
                        <Badge variant="secondary" className="bg-[#F5F3FF] text-[#7C3AED]">
                          <BadgeCheck className="mr-1 h-3 w-3" />
                          {option.badge}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs leading-relaxed text-[#64748B]">{option.description}</p>
                  </div>
                </div>
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
              {option.example}
            </TooltipContent>
          </Tooltip>
        ))}
      </RadioGroup>
    </TooltipProvider>
  );
}

