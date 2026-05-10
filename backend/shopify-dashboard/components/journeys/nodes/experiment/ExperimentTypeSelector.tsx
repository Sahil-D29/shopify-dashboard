"use client";

import { AlertCircle, LayoutList, SplitSquareHorizontal } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type { ExperimentType } from "@/lib/types/experiment-config";

interface ExperimentTypeSelectorProps {
  value: ExperimentType;
  onChange: (type: ExperimentType) => void;
  disableMultivariate?: boolean;
  estimatedDailyTraffic?: number;
}

const OPTIONS: Array<{
  value: ExperimentType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "ab_test",
    title: "A/B Test",
    description: "Compare two or more variants of a single experience to determine the best performer.",
    icon: SplitSquareHorizontal,
  },
  {
    value: "multivariate",
    title: "Multivariate Test",
    description: "Test multiple variables simultaneously to see which combination performs best.",
    icon: LayoutList,
  },
];

export function ExperimentTypeSelector({
  value,
  onChange,
  disableMultivariate = false,
  estimatedDailyTraffic,
}: ExperimentTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <RadioGroup value={value} onValueChange={type => onChange(type as ExperimentType)} className="grid gap-3 md:grid-cols-2">
        {OPTIONS.map(option => {
          const isDisabled = option.value === "multivariate" && disableMultivariate;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              htmlFor={`experiment-type-${option.value}`}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded-2xl border px-4 py-4 transition",
                value === option.value ? "border-[#7C3AED] bg-[#F5F3FF] shadow" : "border-[#E2E8F0] bg-white hover:border-[#7C3AED]/50",
                isDisabled && "cursor-not-allowed opacity-60 hover:border-[#E2E8F0]",
              )}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem id={`experiment-type-${option.value}`} value={option.value} disabled={isDisabled} />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#5B21B6]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E293B]">{option.title}</p>
                  <p className="text-xs leading-relaxed text-[#64748B]">{option.description}</p>
                </div>
              </div>
              {isDisabled ? (
                <p className="rounded-lg border border-dashed border-[#F97316] bg-[#FFF7ED] px-3 py-2 text-xs text-[#C2410C]">
                  Multivariate testing requires higher traffic. Increase your daily users before using this option.
                </p>
              ) : null}
            </label>
          );
        })}
      </RadioGroup>

      <Alert className="border-[#DBEAFE] bg-[#EFF6FF] text-[#1E3A8A]">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-1 text-sm">
          <p>
            <strong>A/B Test:</strong> Ideal when you want to compare a baseline against one or more variations and have moderate traffic.
          </p>
          <p>
            <strong>Multivariate Test:</strong> Best when you have high traffic and need to evaluate combinations of multiple elements.
          </p>
          {typeof estimatedDailyTraffic === "number" ? (
            <p className="text-xs text-[#1D4ED8]">
              Estimated daily traffic: {estimatedDailyTraffic.toLocaleString()} users.
            </p>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}



