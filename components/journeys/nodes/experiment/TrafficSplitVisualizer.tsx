"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { Variant } from "@/lib/types/experiment-config";

interface TrafficSplitVisualizerProps {
  variants: Variant[];
  visualType?: "bar" | "pie";
  estimatedDailyTraffic?: number;
}

const FALLBACK_COLORS = ["#6366F1", "#F97316", "#10B981", "#EC4899", "#0EA5E9", "#F59E0B", "#8B5CF6", "#EF4444"];

function withColor(variant: Variant, index: number) {
  return variant.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function TrafficSplitVisualizer({ variants, visualType = "bar", estimatedDailyTraffic }: TrafficSplitVisualizerProps) {
  const pieGradient = useMemo(() => {
    let current = 0;
    const segments = variants.map((variant, index) => {
      const start = current;
      current += variant.trafficAllocation;
      const end = current;
      return `${withColor(variant, index)} ${start}% ${end}%`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [variants]);

  const totalTraffic = variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Traffic distribution</p>
          <p className="text-xs text-[#64748B]">Visualise how traffic is split across variants.</p>
        </div>
        <Tabs defaultValue={visualType}>
          <TabsList className="h-8 border border-[#E2E8F0]">
            <TabsTrigger className="px-3 text-xs" value="bar">
              Bar
            </TabsTrigger>
            <TabsTrigger className="px-3 text-xs" value="pie">
              Pie
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bar" />
          <TabsContent value="pie" />
        </Tabs>
      </div>

      <Tabs defaultValue={visualType}>
        <TabsList className="hidden">
          <TabsTrigger value="bar" />
          <TabsTrigger value="pie" />
        </TabsList>

        <TabsContent value="bar">
          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div key={variant.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#475569]">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: withColor(variant, index) }}
                    />
                    <span className="font-medium text-[#1E293B]">{variant.name}</span>
                    {variant.isControl ? (
                      <Badge variant="secondary" className="bg-[#E0E7FF] text-[#3730A3]">
                        Control
                      </Badge>
                    ) : null}
                  </div>
                  <span>
                    {variant.trafficAllocation.toFixed(1)}%
                    {estimatedDailyTraffic
                      ? ` • ~${Math.round((variant.trafficAllocation / 100) * estimatedDailyTraffic).toLocaleString()} users/day`
                      : ""}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${variant.trafficAllocation}%`,
                      backgroundColor: withColor(variant, index),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pie">
          <div className="flex flex-col gap-4 md:flex-row">
            <div
              className="mx-auto h-48 w-48 rounded-full shadow-inner shadow-[#E2E8F0]"
              style={{ background: pieGradient }}
            />
            <div className="flex-1 space-y-2">
              {variants.map((variant, index) => (
                <div key={variant.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: withColor(variant, index) }}
                    />
                    <span>{variant.name}</span>
                    {variant.isControl ? (
                      <Badge variant="secondary" className="bg-[#E0E7FF] text-[#3730A3]">
                        Control
                      </Badge>
                    ) : null}
                  </div>
                  <span>
                    {variant.trafficAllocation.toFixed(1)}%
                    {estimatedDailyTraffic
                      ? ` • ~${Math.round((variant.trafficAllocation / 100) * estimatedDailyTraffic).toLocaleString()} users/day`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
        Total allocation: {totalTraffic.toFixed(1)}%
      </div>
    </section>
  );
}



