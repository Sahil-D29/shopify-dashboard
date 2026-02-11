"use client";

import { Fragment } from "react";
import { Award, CalendarClock, ClipboardList, Gauge, LayoutDashboard, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { ExperimentConfig, Goal, Variant } from "@/lib/types/experiment-config";

interface ExperimentSummaryProps {
  config: ExperimentConfig;
  onEditStep?: (stepIndex: number) => void;
}

function formatGoal(goal: Goal) {
  const type = goal.type.replace(/_/g, " ");
  const window = `${goal.attributionWindow.value} ${goal.attributionWindow.unit}`;
  return `${type} • Attribution window: ${window}`;
}

function formatVariant(variant: Variant) {
  return `${variant.name} - ${variant.trafficAllocation.toFixed(1)}%${variant.isControl ? " (Control)" : ""}`;
}

export function ExperimentSummary({ config, onEditStep }: ExperimentSummaryProps) {
  const primaryGoal = config.goals.find(goal => goal.id === config.primaryGoalId);
  const variants = config.variants;

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0E7FF] text-[#4338CA]">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">{config.experimentName}</p>
          <p className="text-xs text-[#64748B]">Review experiment setup before saving.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#1E293B]">
        <p className="font-medium text-[#4338CA]">{config.experimentType === "ab_test" ? "A/B Test" : "Multivariate Test"}</p>
        {config.description ? <p className="text-xs text-[#475569]">{config.description}</p> : null}
        {config.hypothesis ? (
          <p className="mt-2 text-xs text-[#64748B]">
            <span className="font-semibold text-[#1E293B]">Hypothesis:</span> {config.hypothesis}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#22C55E]" />
            <h4 className="text-sm font-semibold text-[#1E293B]">Variants</h4>
          </div>
          {onEditStep ? (
            <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
              Edit
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          {config.variants.map(variant => (
            <div key={variant.id} className="flex items-center justify-between text-xs text-[#475569]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: variant.color ?? "#6366F1" }} />
                <span>{formatVariant(variant)}</span>
              </div>
              {config.sampleSize.result ? (
                <span className="text-[#94A3B8]">
                  ~{Math.round(config.sampleSize.result.usersPerVariant).toLocaleString()} users
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#6366F1]" />
            <h4 className="text-sm font-semibold text-[#1E293B]">Sample size</h4>
          </div>
          {onEditStep ? (
            <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
              Edit
            </Button>
          ) : null}
        </div>
        {config.sampleSize.result ? (
          <div className="grid gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569] md:grid-cols-3">
            <div>
              <p className="font-semibold text-[#1E293B]">Users per variant</p>
              <p>{config.sampleSize.result.usersPerVariant.toLocaleString()}</p>
            </div>
            <div>
              <p className="font-semibold text-[#1E293B]">Total users</p>
              <p>{config.sampleSize.result.totalUsers.toLocaleString()}</p>
            </div>
            <div>
              <p className="font-semibold text-[#1E293B]">Runtime</p>
              <p>{config.sampleSize.result.estimatedDays} days</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-red-600">Sample size not calculated yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#2563EB]" />
            <h4 className="text-sm font-semibold text-[#1E293B]">Goals</h4>
          </div>
          {onEditStep ? (
            <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
              Edit
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          {config.goals.map((goal, index) => (
            <Fragment key={goal.id}>
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <div>
                  <span className="font-semibold text-[#1E293B]">{goal.name}</span>
                  {goal.id === config.primaryGoalId ? (
                    <Badge variant="secondary" className="ml-2 bg-[#DBEAFE] text-[#1D4ED8]">
                      Primary
                    </Badge>
                  ) : null}
                  <p>{formatGoal(goal)}</p>
                </div>
              </div>
              {index < config.goals.length - 1 ? <Separator /> : null}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#F97316]" />
            <h4 className="text-sm font-semibold text-[#1E293B]">Winning criteria</h4>
          </div>
          {onEditStep ? (
            <Button variant="ghost" size="sm" onClick={() => onEditStep(4)}>
              Edit
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-xs text-[#9A3412]">
          <p>
            Strategy: {config.winningCriteria.strategy === "automatic" ? "Automatic (declare winner when conditions are met)" : "Manual review"}
          </p>
          <p>Minimum lift: {(config.winningCriteria.minimumLift * 100).toFixed(1)}%</p>
          <p>
            Minimum runtime: {config.winningCriteria.minimumRuntime.value} {config.winningCriteria.minimumRuntime.unit}
          </p>
          <p>
            Post test action: {config.winningCriteria.postTestAction.replace(/_/g, " ")}
            {config.winningCriteria.postTestAction === "send_all_to_specific" && config.winningCriteria.specificVariantId
              ? ` → ${variants.find(variant => variant.id === config.winningCriteria.specificVariantId)?.name ?? "Variant"}`
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}


