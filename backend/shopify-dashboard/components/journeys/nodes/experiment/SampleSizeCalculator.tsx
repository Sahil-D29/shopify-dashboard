"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { SampleSizeParams, SampleSizeResult } from "@/lib/types/experiment-config";

interface SampleSizeCalculatorProps {
  params: SampleSizeParams;
  result?: SampleSizeResult;
  onChange: (params: SampleSizeParams) => void;
  onCalculate: (result: SampleSizeResult) => void;
  numberOfVariants: number;
  estimatedDailyTraffic?: number;
}

const CONFIDENCE_LEVELS = [
  { value: 0.9, label: "90%" },
  { value: 0.95, label: "95%" },
  { value: 0.99, label: "99%" },
];

const STATISTICAL_POWER = [
  { value: 0.7, label: "70%" },
  { value: 0.8, label: "80%" },
  { value: 0.9, label: "90%" },
];

export function SampleSizeCalculator({
  params,
  result,
  onChange,
  onCalculate,
  numberOfVariants,
  estimatedDailyTraffic,
}: SampleSizeCalculatorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.numberOfVariants !== numberOfVariants) {
      onChange({ ...params, numberOfVariants });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfVariants]);

  const baselinePercent = useMemo(() => Number((params.baselineConversionRate * 100).toFixed(2)), [params.baselineConversionRate]);
  const minDetectablePercent = useMemo(() => Number((params.minimumDetectableEffect * 100).toFixed(1)), [params.minimumDetectableEffect]);

  const handleBaselineChange = (value: number) => {
    const rate = Math.max(0.1, Math.min(50, value));
    onChange({ ...params, baselineConversionRate: rate / 100 });
  };

  const handleDetectableChange = (value: number) => {
    const effect = Math.max(1, Math.min(100, value));
    onChange({ ...params, minimumDetectableEffect: effect / 100 });
  };

  const handleCalculate = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/experiments/sample-size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, numberOfVariants }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to calculate sample size.");
      }
      const data = (await response.json()) as SampleSizeResult;
      onCalculate(data);
    } catch (err: any) {
      console.error("[SampleSizeCalculator] calculate", err);
      setError(err?.message ?? "Unable to calculate sample size.");
    } finally {
      setLoading(false);
    }
  };

  const largeSample = result?.usersPerVariant && result.usersPerVariant > 50000;

  return (
    <TooltipProvider>
      <section className="space-y-6 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <header className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1D4ED8]">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">Sample size estimation</p>
            <p className="text-xs text-[#64748B]">
              Provide baseline metrics to estimate how many users you need for statistical significance.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <Label>Baseline conversion rate</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">Why?</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Estimate the current conversion rate for your control experience. This helps size the test properly.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={baselinePercent}
                onChange={event => handleBaselineChange(Number(event.target.value))}
              />
              <span className="text-sm text-[#475569]">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <Label>Minimum detectable effect</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">MDE</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  The smallest relative improvement you want to detect between variants. Smaller effects require more users.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
              <Slider
                min={1}
                max={100}
                step={1}
                value={[minDetectablePercent]}
                onValueChange={([value]) => handleDetectableChange(value)}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={minDetectablePercent}
                  onChange={event => handleDetectableChange(Number(event.target.value))}
                />
                <span className="text-sm text-[#475569]">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Confidence level</Label>
            <Select
              value={params.confidenceLevel.toString()}
              onValueChange={value => onChange({ ...params, confidenceLevel: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE_LEVELS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Statistical power</Label>
            <Select
              value={params.statisticalPower.toString()}
              onValueChange={value => onChange({ ...params, statisticalPower: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATISTICAL_POWER.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#475569]">
          Using {numberOfVariants} {numberOfVariants === 1 ? "variant" : "variants"} in this experiment. Adjusting the number of variants
          will automatically update the sample size requirements.
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>{error}</div>
          </div>
        ) : null}

        <Button type="button" onClick={handleCalculate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Calculate sample size
        </Button>

        {result ? (
          <div className="space-y-3 rounded-2xl border border-[#DCFCE7] bg-[#ECFDF5] p-4 text-sm text-[#166534]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#15803D]">Sample size recommendation</span>
              <span className="text-xs text-[#166534]">Confidence: {(result.confidenceLevel * 100).toFixed(0)}%</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">Users per variant</p>
                <p className="text-lg font-semibold text-[#166534]">{result.usersPerVariant.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">Total users</p>
                <p className="text-lg font-semibold text-[#166534]">{result.totalUsers.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[#94A3B8]">Estimated runtime</p>
                <p className="text-lg font-semibold text-[#166534]">{result.estimatedDays} days</p>
              </div>
            </div>
            {estimatedDailyTraffic ? (
              <p className="text-xs">
                With ~{estimatedDailyTraffic.toLocaleString()} users per day, you’ll reach the required sample size in approximately{" "}
                {Math.ceil(result.totalUsers / estimatedDailyTraffic)} days.
              </p>
            ) : null}
          </div>
        ) : null}

        {largeSample ? (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
            High sample size detected. Consider increasing your minimum detectable effect or reducing the confidence level to shorten test duration.
          </div>
        ) : null}
      </section>
    </TooltipProvider>
  );
}



