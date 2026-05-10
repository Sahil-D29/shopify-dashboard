"use client";

import { AlertTriangle, BarChart2, RefreshCcw, Users } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import type { AudienceEstimate } from "@/lib/types/trigger-config";
import { cn } from "@/lib/utils";

interface AudienceEstimatorProps {
  estimate?: AudienceEstimate;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

function formatNumber(value?: number | null): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatUpdatedAt(timestamp?: string): string | null {
  if (!timestamp) return null;
  try {
    const parsed = parseISO(timestamp);
    return formatDistanceToNowStrict(parsed, { addSuffix: true });
  } catch {
    return null;
  }
}

export function AudienceEstimator({ estimate, loading = false, onRefresh, className }: AudienceEstimatorProps) {
  const lastCalculated = formatUpdatedAt(estimate?.lastCalculatedAt);

  return (
    <section className={cn("space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm", className)}>
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF3E7]">
            <BarChart2 className="h-5 w-5 text-[#D79C5C]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#3A3028]">Preview &amp; Validation</h3>
            <p className="text-xs text-[#8B7F76]">Estimate audience size and daily entries for this configuration.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="flex items-center gap-2 border-[#E8E4DE] text-[#4A4139] hover:bg-[#F5F3EE]"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <svg className="h-4 w-4 animate-spin text-[#D4A574]" viewBox="0 0 24 24" role="presentation">
              <circle className="opacity-10" cx="12" cy="12" r="10" stroke="#D4A574" strokeWidth="4" fill="none" />
              <path className="opacity-80" fill="#D4A574" d="M4 12a8 8 0 017-7.938V2A10 10 0 002 12h2z" />
            </svg>
          ) : (
            <RefreshCcw className="h-4 w-4 text-[#D4A574]" />
          )}
          {loading ? "Calculating…" : "Refresh estimate"}
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-5 py-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#B8977F]">Estimated Daily Entries</p>
          <p className="mt-3 text-3xl font-semibold text-[#3A3028]">{formatNumber(estimate?.dailyEntries)}</p>
        </div>
        <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-5 py-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#B8977F]">Total Audience Size</p>
          <p className="mt-3 text-3xl font-semibold text-[#3A3028]">{formatNumber(estimate?.totalAudience)}</p>
        </div>
      </div>

      {estimate?.warnings?.length ? (
        <div className="space-y-2 rounded-xl border border-[#F1C8AD] bg-[#FEF5EF] px-4 py-4 text-xs text-[#9C613C]">
          <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em]">
            <AlertTriangle className="h-4 w-4" />
            Warnings
          </div>
          <ul className="space-y-1">
            {estimate.warnings.map(warning => (
              <li key={warning} className="leading-relaxed">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {estimate?.conflicts?.length ? (
        <div className="space-y-2 rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-4 py-4 text-xs text-[#8B7F76]">
          <div className="flex items-center gap-2 font-semibold text-[#4A4139]">
            <Users className="h-4 w-4 text-[#D4A574]" />
            Conflicting journeys
          </div>
          <p className="text-xs leading-relaxed">
            These journeys have overlapping triggers. Consider reviewing enrolment rules to avoid double messaging.
          </p>
          <ul className="space-y-1">
            {estimate.conflicts.map(conflict => (
              <li key={conflict.journeyId} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
                <span className="font-medium text-[#3A3028]">{conflict.journeyName}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#B9AA9F]">{conflict.journeyId}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastCalculated ? (
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#B9AA9F]">
          Last calculated {lastCalculated}
        </p>
      ) : null}
    </section>
  );
}

export default AudienceEstimator;


