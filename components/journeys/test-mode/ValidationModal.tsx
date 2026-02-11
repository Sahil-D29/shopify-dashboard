"use client";

import { Fragment } from "react";
import { AlertCircle, CheckCircle2, ShieldAlert, TriangleAlert } from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ValidationError } from "@/lib/types/test-mode";
import { cn } from "@/lib/utils";

interface ValidationModalProps {
  open: boolean;
  isLoading?: boolean;
  errors: ValidationError[];
  onClose: () => void;
  onGoToNode?: (nodeId: string) => void;
  onActivate?: () => void;
  onActivateAnyway?: () => void;
  onCreateSnapshot?: () => void;
}

export function ValidationModal({
  open,
  onClose,
  errors,
  isLoading = false,
  onGoToNode,
  onActivate,
  onActivateAnyway,
}: ValidationModalProps) {
  const hasErrors = errors.some(error => error.errorType === "error");
  const warnings = errors.filter(error => error.errorType === "warning");
  const blockers = errors.filter(error => error.errorType === "error");

  let title = "Validation results";
  let subtitle = "Review validation feedback before continuing.";
  let icon = CheckCircle2;
  let iconClass = "text-emerald-500";

  if (isLoading) {
    title = "Validating journey…";
    subtitle = "Hang tight while we run the checks.";
  } else if (hasErrors) {
    title = "Cannot activate";
    subtitle = "Fix these issues before activating your journey.";
    icon = ShieldAlert;
    iconClass = "text-rose-500";
  } else if (warnings.length) {
    title = "Warnings found";
    subtitle = "You can activate anyway, but review the warnings first.";
    icon = TriangleAlert;
    iconClass = "text-amber-500";
  } else {
    title = "Ready to activate";
    subtitle = "Everything looks good. You’re ready to go live.";
  }

  const IconComponent = icon;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      closeOnOverlay={!isLoading}
      showCloseButton={!isLoading}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-slate-100", iconClass)}>
            <IconComponent className="h-5 w-5" />
          </span>
          <div className="text-sm text-[#475569]">
            {isLoading ? "Running validation checks…" : "Validation completed."}
            {!isLoading && !errors.length ? " No issues found." : null}
          </div>
        </div>

        {errors.length ? (
          <ScrollArea className="max-h-[50vh] rounded-2xl border border-[#E2E8F0] bg-white">
            <ul className="divide-y divide-[#E2E8F0]">
              {errors.map(error => (
                <li key={`${error.nodeId}-${error.message}`} className="flex items-start gap-3 px-4 py-3 text-sm text-[#0F172A]">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      error.errorType === "error" ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500",
                    )}
                  >
                    {error.errorType === "error" ? <ShieldAlert className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{error.nodeName}</p>
                    <p className="text-xs text-[#475569]">{error.message}</p>
                    {error.suggestion ? <p className="text-xs text-[#94A3B8]">{error.suggestion}</p> : null}
                    {onGoToNode ? (
                      <Button variant="link" className="px-0 text-xs text-indigo-600" onClick={() => onGoToNode(error.nodeId)}>
                        Go to node
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Close
          </Button>
          {!hasErrors && warnings.length > 0 ? (
            <Fragment>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={onActivateAnyway} disabled={isLoading}>
                Activate anyway
              </Button>
            </Fragment>
          ) : null}
          {!hasErrors && warnings.length === 0 ? (
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={onActivate} disabled={isLoading}>
              Activate journey
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}



