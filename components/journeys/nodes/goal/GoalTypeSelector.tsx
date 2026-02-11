"use client";

import { Trophy, ShoppingCart, MessageCircle, Zap, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { GoalType } from "@/lib/types/goal-config";

interface GoalTypeSelectorProps {
  value: GoalType;
  onChange: (type: GoalType) => void;
  disabled?: boolean;
}

const GOAL_TYPE_OPTIONS: Array<{
  value: GoalType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}> = [
  {
    value: "journey_completion",
    title: "Journey Completion",
    description: "Track users who complete all journey steps.",
    icon: Trophy,
    badge: "Primary",
  },
  {
    value: "shopify_event",
    title: "Shopify Event",
    description: "Measure conversions on Shopify events like orders or checkouts.",
    icon: ShoppingCart,
  },
  {
    value: "whatsapp_engagement",
    title: "WhatsApp Engagement",
    description: "Goal triggered when users reply or click on WhatsApp messages.",
    icon: MessageCircle,
  },
  {
    value: "custom_event",
    title: "Custom Event",
    description: "Listen for bespoke events tracked from your store or backend.",
    icon: Zap,
  },
  {
    value: "segment_entry",
    title: "Segment Entry",
    description: "Goal completes when users join a specific audience segment.",
    icon: Users,
  },
];

export function GoalTypeSelector({ value, onChange, disabled = false }: GoalTypeSelectorProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={next => onChange(next as GoalType)}
      className="grid gap-3 md:grid-cols-2"
      disabled={disabled}
    >
      {GOAL_TYPE_OPTIONS.map(option => {
        const Icon = option.icon;
        const isSelected = option.value === value;
        return (
          <label
            key={option.value}
            htmlFor={`goal-type-${option.value}`}
            className={cn(
              "flex cursor-pointer flex-col gap-3 rounded-2xl border px-4 py-4 transition",
              isSelected ? "border-[#10B981] bg-emerald-50 shadow" : "border-[#E2E8F0] bg-white hover:border-[#10B981]/50",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem id={`goal-type-${option.value}`} value={option.value} disabled={disabled} />
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Icon className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">{option.title}</p>
                  {option.badge ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                      {option.badge}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">{option.description}</p>
              </div>
            </div>
          </label>
        );
      })}
    </RadioGroup>
  );
}



