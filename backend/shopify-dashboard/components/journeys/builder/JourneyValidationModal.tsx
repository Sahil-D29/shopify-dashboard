import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';

import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JourneyValidationResult } from '@/lib/journey-engine/validation';

interface JourneyValidationModalProps {
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
  onProceed?: () => void;
  isLoading?: boolean;
  result: JourneyValidationResult | null;
  pendingAction?: 'activate' | null;
}

export function JourneyValidationModal({
  open,
  onClose,
  onRetry,
  onProceed,
  isLoading,
  result,
  pendingAction = null,
}: JourneyValidationModalProps) {
  const hasErrors = Boolean(result?.errors?.length);
  const hasWarnings = Boolean(result?.warnings?.length);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Pre-Activation Check"
      subtitle="Review blockers and warnings identified during validation."
      size="xl"
      gradient
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" onClick={onRetry} disabled={isLoading} className="text-[#8B7F76] hover:bg-[#F5F3EE]">
            Refresh Validation
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-[#8B7F76] hover:bg-[#F5F3EE]">
              Close
            </Button>
            {pendingAction === 'activate' ? (
              <Button
                onClick={onProceed}
                disabled={hasErrors || isLoading}
                className="bg-[#D4A574] text-white hover:bg-[#B8835D] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activate Journey
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[#8B7F76]">
          <ShieldCheck className="h-6 w-6 animate-pulse text-[#D4A574]" />
          Running validation…
        </div>
      ) : !result ? (
        <div className="rounded-3xl border border-[#E8E4DE] bg-[#FAF9F6] px-6 py-8 text-center text-sm text-[#8B7F76]">
          Validation results will appear here once the journey is analysed.
        </div>
      ) : (
        <div className="space-y-6">
          <ValidationSummary result={result} />
          {hasErrors ? (
            <ValidationSection
              title="Blockers"
              tone="error"
              issues={result.errors}
              emptyLabel="No blocking issues detected."
            />
          ) : null}
          {hasWarnings ? (
            <ValidationSection
              title="Warnings"
              tone="warning"
              issues={result.warnings}
              emptyLabel="No warnings detected."
            />
          ) : null}
          {!hasErrors && !hasWarnings ? (
            <div className="rounded-3xl border border-[#E8E4DE] bg-white px-6 py-6 text-sm text-[#4A4139]">
              <div className="flex items-center gap-3 text-[#2F7A3E]">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Journey looks good!</span>
              </div>
              <p className="mt-2 text-sm text-[#8B7F76]">
                No blockers or warnings detected. You can safely activate the journey when ready.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

interface ValidationSummaryProps {
  result: JourneyValidationResult;
}

function ValidationSummary({ result }: ValidationSummaryProps) {
  const toneClasses =
    result.status === 'pass'
      ? 'border-[#BFDEC1] bg-[#F1FFF3]'
      : result.status === 'needs_attention'
        ? 'border-[#F5E2C0] bg-[#FFF7E8]'
        : 'border-[#F3C8C8] bg-[#FFF1F1]';

  const Icon =
    result.status === 'pass'
      ? ShieldCheck
      : result.status === 'needs_attention'
        ? ShieldAlert
        : XCircle;

  const label =
    result.status === 'pass'
      ? 'Ready to activate'
      : result.status === 'needs_attention'
        ? 'Needs attention'
        : 'Cannot activate';

  return (
    <div className={cn('rounded-3xl border px-6 py-5 shadow-sm', toneClasses)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-[#4A4139]" />
          <div>
            <p className="text-sm font-semibold text-[#4A4139]">{label}</p>
            <p className="text-xs text-[#8B7F76]">
              Analysed {new Date(result.summary.evaluatedAt).toLocaleString()} ·{' '}
              {result.summary.nodeCount} nodes · {result.summary.edgeCount} connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-[#8B7F76]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1">
            <XCircle className="h-4 w-4 text-[#B45151]" />
            {result.errors.length} blocker{result.errors.length === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1">
            <AlertTriangle className="h-4 w-4 text-[#B3843B]" />
            {result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ValidationSectionProps {
  title: string;
  tone: 'error' | 'warning';
  issues: JourneyValidationResult['errors'];
  emptyLabel: string;
}

function ValidationSection({ title, tone, issues, emptyLabel }: ValidationSectionProps) {
  const toneClasses =
    tone === 'error'
      ? {
          badge: 'bg-[#FDE7E7] text-[#B45151]',
          border: 'border-[#F3C8C8]',
          icon: XCircle,
        }
      : {
          badge: 'bg-[#FFF1DE] text-[#B3843B]',
          border: 'border-[#F5E2C0]',
          icon: AlertTriangle,
        };

  const Icon = toneClasses.icon;

  return (
    <div className={cn('rounded-3xl border bg-white px-6 py-5 shadow-sm', toneClasses.border)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#4A4139]">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs uppercase tracking-wide', toneClasses.badge)}>
          {issues.length}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {issues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-4 py-4 text-xs text-[#8B7F76]">
            {emptyLabel}
          </div>
        ) : (
          issues.map(issue => (
            <div key={issue.id} className="rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] px-4 py-4 text-sm text-[#4A4139]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{issue.title}</p>
                  {issue.description ? (
                    <p className="mt-1 text-sm text-[#8B7F76]">{issue.description}</p>
                  ) : null}
                  {issue.suggestion ? (
                    <p className="mt-2 text-xs text-[#B8977F]">{issue.suggestion}</p>
                  ) : null}
                </div>
                {issue.nodeName ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-wide text-[#8B7F76]">
                    {issue.nodeName}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

