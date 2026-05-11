"use client";

import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type {
  DelayConfig,
  DelayPreviewScenario,
  FixedTimeDelayConfig,
  OptimalSendTimeConfig,
  WaitForAttributeConfig,
  WaitForEventConfig,
  WaitUntilTimeConfig,
} from "@/lib/types/delay-config";

interface DelayPreviewCardProps {
  config: DelayConfig;
  scenarios?: DelayPreviewScenario[];
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
}

function formatTimestamp(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function formatTimeOfDay(time: { hour: number; minute: number }) {
  const hour12 = time.hour % 12 || 12;
  const suffix = time.hour >= 12 ? "PM" : "AM";
  return `${hour12}:${time.minute.toString().padStart(2, "0")} ${suffix}`;
}

export function DelayPreviewCard({
  config,
  scenarios = [],
  onRefresh,
  loading = false,
  error = null,
}: DelayPreviewCardProps) {
  let description: string;
  switch (config.delayType) {
    case "fixed_time": {
      const details = config.specificConfig as FixedTimeDelayConfig;
      description = `Users wait ${details.duration.value} ${details.duration.unit}`;
      break;
    }
    case "wait_until_time": {
      const details = config.specificConfig as WaitUntilTimeConfig;
      description = `Users wait until ${formatTimeOfDay(details.time)} in ${details.timezone} timezone`;
      break;
    }
    case "wait_for_event": {
      const details = config.specificConfig as WaitForEventConfig;
      description = `Waiting for event “${details.eventName || "event"}” (timeout ${details.maxWaitTime.value} ${details.maxWaitTime.unit})`;
      break;
    }
    case "optimal_send_time": {
      const details = config.specificConfig as OptimalSendTimeConfig;
      description = `AI selects the best time within ${details.window.duration.value} ${details.window.duration.unit}`;
      break;
    }
    case "wait_for_attribute": {
      const details = config.specificConfig as WaitForAttributeConfig;
      description = `Waiting until ${details.attributePath || "attribute"} equals ${String(details.targetValue ?? "?")}`;
      break;
    }
    default:
      description = "Delay configuration preview";
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">Preview scenarios</p>
          <p className="text-xs text-[#64748B]">Examples of how customers will progress through this delay.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="border-[#E2E8F0] text-[#1D4ED8] hover:bg-[#EFF6FF]"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </header>

      <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] px-4 py-3 text-xs text-[#4338CA]">
        <p>{description}.</p>
        {config.quietHours?.enabled ? (
          <p>
            Quiet hours enabled: {formatTimeOfDay(config.quietHours.startTime)} – {formatTimeOfDay(config.quietHours.endTime)} (
            {config.quietHours.timezone === "customer" ? "customer local time" : config.quietHours.timezone}).
          </p>
        ) : null}
        {config.holidaySettings?.skipWeekends ? <p>Weekends will be skipped.</p> : null}
        {config.holidaySettings?.skipHolidays ? <p>Public holidays are skipped based on the selected calendar.</p> : null}
        {config.throttling?.enabled ? <p>Throttling limits apply and may extend wait time.</p> : null}
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {scenarios.length ? (
          scenarios.map((scenario, index) => (
            <div key={`${scenario.userEntersAt}-${index}`} className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm">
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <span>Enter • {formatTimestamp(scenario.userEntersAt)}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Continue • {formatTimestamp(scenario.userContinuesAt)}</span>
              </div>
              <p className="text-xs text-[#1E293B]">{scenario.explanation}</p>
              {scenario.warnings?.length ? (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {scenario.warnings.map(warning => (
                    <li key={warning}>⚠︎ {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-5 text-center text-sm text-[#6366F1]">
            No preview scenarios yet. Configure the delay and click refresh to generate examples.
          </p>
        )}
      </div>
    </section>
  );
}


