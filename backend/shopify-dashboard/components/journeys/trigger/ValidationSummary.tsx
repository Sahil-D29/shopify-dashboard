'use client';

import { AlertCircle, Info } from 'lucide-react';

interface ValidationSummaryProps {
  errors: string[];
  warnings: string[];
  visible: boolean;
}

export function ValidationSummary({ errors, warnings, visible }: ValidationSummaryProps) {
  if ((!visible || errors.length === 0) && warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visible && errors.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Resolve the following before saving or activating
          </div>
          <ul className="list-inside list-disc space-y-1">
            {errors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4" aria-hidden="true" />
            Recommended checks
          </div>
          <ul className="list-inside list-disc space-y-1">
            {warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

ValidationSummary.displayName = 'ValidationSummary';


