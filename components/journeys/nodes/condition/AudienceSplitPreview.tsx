"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudienceSplitPreviewProps {
  trueCount: number;
  falseCount: number;
  truePercentage: number;
  falsePercentage: number;
  totalAudience: number;
  testMode?: boolean;
  onTestClick?: () => void;
  className?: string;
}

export function AudienceSplitPreview({
  trueCount,
  falseCount,
  truePercentage,
  falsePercentage,
  totalAudience,
  testMode = false,
  onTestClick,
  className,
}: AudienceSplitPreviewProps) {
  const clampedTrue = Math.min(100, Math.max(0, truePercentage));
  const clampedFalse = Math.min(100, Math.max(0, falsePercentage));

  return (
    <section className={cn("space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-5 shadow-sm", className)}>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Audience Split</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Projected Decision Outcome</h3>
        <p className="text-sm text-[#8B7F76]">
          Based on recent data, this condition is expected to route users along the following paths.
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-[#2F5130]">True Path</span>
            <span className="text-[#4A4139]">
              {trueCount.toLocaleString()} users ({clampedTrue.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#E5F3E1]">
            <div
              className="h-2 rounded-full bg-[#7FA17A]"
              style={{ width: `${clampedTrue}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-[#7F1D1D]">False Path</span>
            <span className="text-[#4A4139]">
              {falseCount.toLocaleString()} users ({clampedFalse.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#FBE4E2]">
            <div
              className="h-2 rounded-full bg-[#EC7A6C]"
              style={{ width: `${clampedFalse}%` }}
            />
          </div>
        </div>

        <div className="text-center text-sm text-[#8B7F76]">
          Total audience analysed: <span className="font-medium text-[#4A4139]">{totalAudience.toLocaleString()}</span>{" "}
          users
        </div>

        {testMode ? (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={onTestClick}>
              Test with Sample Users
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}



