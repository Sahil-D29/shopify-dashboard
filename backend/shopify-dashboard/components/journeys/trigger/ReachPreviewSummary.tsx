'use client';

import { RefreshCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TriggerReachPreview } from './types';

interface ReachPreviewSummaryProps {
  preview: TriggerReachPreview | null;
  isLoading: boolean;
  error: string | null;
  isEligible: boolean;
  onManualRefresh: () => void;
}

export function ReachPreviewSummary({
  preview,
  isLoading,
  error,
  isEligible,
  onManualRefresh,
}: ReachPreviewSummaryProps) {
  return (
    <aside
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">
            Estimated Reach
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onManualRefresh}
          disabled={isLoading}
        >
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {isLoading ? 'Calculating…' : 'Recalculate'}
        </Button>
      </header>
      <div className="space-y-1">
        <p className="text-3xl font-semibold text-slate-900">
          {isLoading ? '—' : preview ? preview.estimatedCount.toLocaleString() : '—'}
        </p>
        <p className="text-xs text-slate-500">
          {error
            ? error
            : preview
              ? `Last updated ${new Date(preview.lastUpdated).toLocaleTimeString()}`
              : isEligible
                ? 'Click recalculate to get an updated estimate.'
                : 'Select an event and resolve validation errors to calculate reach.'}
        </p>
      </div>
    </aside>
  );
}

ReachPreviewSummary.displayName = 'ReachPreviewSummary';

