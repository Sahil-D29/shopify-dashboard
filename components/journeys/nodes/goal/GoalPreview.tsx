"use client";

import { Trophy, Clock, Flag } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GoalConfig } from "@/lib/types/goal-config";
import { cn } from "@/lib/utils";

interface GoalPreviewProps {
  config: GoalConfig;
}

const categoryColors: Record<GoalConfig["goalCategory"], string> = {
  conversion: "bg-emerald-100 text-emerald-700",
  engagement: "bg-sky-100 text-sky-700",
  revenue: "bg-amber-100 text-amber-700",
  retention: "bg-purple-100 text-purple-700",
};

export function GoalPreview({ config }: GoalPreviewProps) {
  return (
    <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-[#0F172A]">{config.goalName || "Goal preview"}</CardTitle>
            <p className="text-xs text-[#64748B]">
              {config.goalDescription || "Configure the details to see a richer preview."}
            </p>
          </div>
        </div>
        <Badge className={cn("text-[11px] font-semibold uppercase", categoryColors[config.goalCategory])}>
          {config.goalCategory}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[#1E293B]">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#94A3B8]">Goal type</p>
          <span className="text-sm capitalize">{config.goalType.replace("_", " ")}</span>
          {config.goalValue !== undefined ? (
            <span className="text-xs text-[#475569]">Target value: {config.goalValue.toLocaleString()}</span>
          ) : null}
        </div>

        {(config.eventName || config.segmentId) && (
          <div className="space-y-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#475569]">
            <p className="font-semibold text-[#0F172A]">Measurement source</p>
            {config.eventName ? <p>Event: {config.eventName}</p> : null}
            {config.segmentId ? <p>Segment: {config.segmentId}</p> : null}
            {config.eventFilters?.length ? (
              <ul className="list-inside list-disc">
                {config.eventFilters.map((filter, index) => (
                  <li key={`${filter.property}-${index}`}>
                    {filter.property} {filter.operator} {String(filter.value)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#1D4ED8]" />
            Attribution window: {config.attributionWindow.value} {config.attributionWindow.unit}
          </span>
          <span className="inline-flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#9333EA]" />
            Model: {config.attributionModel.replace("_", " ")}
          </span>
          <Badge variant="outline" className="text-xs uppercase">
            {config.countMultipleConversions ? "Counts multiple conversions" : "Single conversion per user"}
          </Badge>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F0FDF4] px-4 py-3 text-xs text-[#047857]">
          {config.exitAfterGoal
            ? "Users exit the journey after this goal, ensuring they do not receive further messages."
            : "Users continue through the rest of the journey after hitting this goal."}
          {config.markAsCompleted ? " Journey will be marked as completed in analytics." : null}
        </div>
      </CardContent>
    </Card>
  );
}



