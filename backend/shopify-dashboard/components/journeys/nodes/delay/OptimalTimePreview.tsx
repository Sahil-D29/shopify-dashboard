"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Duration } from "@/lib/types/delay-config";

interface HistoricalDataPoint {
  hour: number;
  engagementRate: number;
}

interface OptimalTimePreviewProps {
  historicalData?: HistoricalDataPoint[];
  optimalWindow?: { start: number; end: number };
  selectedWindow: Duration;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

export function OptimalTimePreview({
  historicalData,
  optimalWindow,
  selectedWindow,
  loading = false,
  error = null,
  onRefresh,
}: OptimalTimePreviewProps) {
  const maxRate =
    historicalData?.reduce((max, point) => Math.max(max, point.engagementRate), 0) ?? 0.01;

  const highlightRange = new Set<number>();
  if (optimalWindow) {
    const range = optimalWindow.end >= optimalWindow.start ? optimalWindow.end - optimalWindow.start : optimalWindow.end + 24 - optimalWindow.start;
    for (let i = 0; i <= range; i += 1) {
      highlightRange.add((optimalWindow.start + i) % 24);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#E0E7FF] bg-[#EEF2FF] p-5 text-sm text-[#312E81]">
      <header className="flex items-center justify-between text-[#1E293B]">
        <div>
          <p className="text-sm font-semibold">Engagement heatmap</p>
          <p className="text-xs text-[#64748B]">
            Based on historical performance. Current window: {selectedWindow.value} {selectedWindow.unit}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="border-[#C7D2FE] bg-white text-[#4C1D95] hover:bg-[#E0E7FF]"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </header>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-[#C7D2FE] bg-white p-4">
        <div className="flex items-end gap-1">
          {Array.from({ length: 24 }, (_, hour) => {
            const rate = historicalData?.find(point => point.hour === hour)?.engagementRate ?? 0;
            const height = Math.max(8, (rate / maxRate) * 140);
            const isHighlighted = highlightRange.has(hour);
            return (
              <div key={hour} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-3 rounded-t-full ${isHighlighted ? "bg-gradient-to-t from-[#7C3AED] to-[#C084FC]" : "bg-[#A5B4FC]"}`}
                  style={{ height }}
                  title={`${hour}:00 — ${(rate * 100).toFixed(1)}%`}
                />
                <span className="text-[10px] uppercase tracking-wide text-[#94A3B8]">{hourLabel(hour)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#4C1D95]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#7C3AED]" /> Optimal window
          </span>
          <span className="flex items-center gap-1 text-[#6366F1]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#A5B4FC]" /> Other hours
          </span>
        </div>
        {!historicalData?.length ? (
          <p className="text-xs text-[#64748B]">Not enough engagement data yet. We’ll optimise timing once data accrues.</p>
        ) : null}
      </div>
    </section>
  );
}

