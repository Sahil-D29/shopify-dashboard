"use client";

import { Fragment, useMemo } from "react";
import { CircleDot, CircleSlash2, Clock, XCircle } from "lucide-react";

import Modal from "@/components/ui/modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JourneyExecutionLog } from "@/lib/types/test-mode";
import { cn } from "@/lib/utils";

interface ExecutionLogModalProps {
  open: boolean;
  onClose: () => void;
  logs: JourneyExecutionLog[];
  testUserLabel?: string;
  onGoToNode?: (nodeId: string) => void;
}

const statusMeta = {
  entered: { label: "Entered", tone: "text-sky-600", bg: "bg-sky-100" },
  completed: { label: "Completed", tone: "text-emerald-600", bg: "bg-emerald-100" },
  failed: { label: "Failed", tone: "text-rose-600", bg: "bg-rose-100" },
  skipped: { label: "Skipped", tone: "text-slate-500", bg: "bg-slate-200" },
};

export function ExecutionLogModal({ open, onClose, logs, testUserLabel, onGoToNode }: ExecutionLogModalProps) {
  const timeline = useMemo(() => [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [logs]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Journey execution log"
      subtitle={testUserLabel ? `Test user · ${testUserLabel}` : "Execution timeline for selected test user"}
      size="lg"
      closeOnOverlay
    >
      <ScrollArea className="max-h-[60vh]">
        <div className="relative pl-6">
          <span className="absolute left-[11px] top-2 h-full w-[2px] bg-slate-200" />
          {timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No execution events recorded for this test user yet.
            </div>
          ) : (
            timeline.map((entry, index) => {
              const status = statusMeta[entry.status] ?? statusMeta.entered;
              const isLast = index === timeline.length - 1;
              const Icon =
                entry.status === "completed"
                  ? CircleDot
                  : entry.status === "failed"
                    ? XCircle
                    : entry.status === "skipped"
                      ? CircleSlash2
                      : CircleDot;
              return (
                <Fragment key={`${entry.nodeId}-${entry.timestamp}`}>
                  <div className="mb-5 flex gap-3">
                    <span className={cn("relative mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white", status.tone)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span>{entry.nodeName}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", status.bg, status.tone)}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        {onGoToNode ? (
                          <button
                            type="button"
                            className="rounded border border-transparent px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                            onClick={() => onGoToNode(entry.nodeId)}
                          >
                            Go to node
                          </button>
                        ) : null}
                      </div>
                      {entry.details ? <p className="mt-2 text-xs text-slate-600">{entry.details}</p> : null}
                    </div>
                  </div>
                  {!isLast ? <div className="ml-6 h-4 w-px" /> : null}
                </Fragment>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Modal>
  );
}



