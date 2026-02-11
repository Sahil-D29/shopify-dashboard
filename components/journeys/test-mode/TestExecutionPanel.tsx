"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowRightCircle, Clock, RefreshCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { JourneyExecutionLog, TestUser } from "@/lib/types/test-mode";

interface JourneyProgress {
  testUser: TestUser;
  currentNode: string;
  status: "waiting" | "running" | "completed" | "failed";
  lastActionAt: string;
}

interface TestExecutionPanelProps {
  testUsers: TestUser[];
  onTriggerJourney: (testUserId: string) => Promise<boolean>;
  onRefreshProgress: () => Promise<void>;
  onClearTestData: () => Promise<void>;
  progress: JourneyProgress[];
  executionLogs: JourneyExecutionLog[];
  onViewExecutionLog: (testUserId: string) => void;
}

export function TestExecutionPanel({
  testUsers,
  onTriggerJourney,
  onRefreshProgress,
  onClearTestData,
  progress,
  executionLogs,
  onViewExecutionLog,
}: TestExecutionPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isTriggering, setIsTriggering] = useState(false);

  const testUserOptions = useMemo(() => testUsers.map(user => ({ label: user.name || user.email || user.phone, value: user.id })), [testUsers]);

  const handleTrigger = async () => {
    if (!selectedUserId) return;
    setIsTriggering(true);
    try {
      await onTriggerJourney(selectedUserId);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0F172A]">
            <ArrowRightCircle className="h-5 w-5 text-indigo-600" />
            Manually trigger journey
          </CardTitle>
          <p className="text-sm text-[#475569]">Select a test user to manually send them through the journey.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#94A3B8]">Test user</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select test user" />
                </SelectTrigger>
                <SelectContent>
                  {testUserOptions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No test users
                    </SelectItem>
                  ) : (
                    testUserOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleTrigger}
              disabled={!selectedUserId || isTriggering}
              className="h-10 self-end bg-indigo-600 text-white hover:bg-indigo-500"
            >
              Trigger now
            </Button>
          </div>
          <p className="text-xs text-[#64748B]">
            Journey triggers simulate production sends but only target the selected test user.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#0F172A]">
              <Activity className="h-5 w-5 text-emerald-600" />
              Journey progress
            </CardTitle>
            <p className="text-sm text-[#475569]">Track how test users are moving through the journey.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onRefreshProgress} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={onClearTestData} className="gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              Clear test data
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-72">
            <div className="space-y-3">
              {progress.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-3 text-sm text-[#475569]">
                  No journey executions yet. Trigger a test user to start collecting data.
                </div>
              ) : (
                progress.map(item => (
                  <div
                    key={item.testUser.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#475569]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0F172A]">
                        {item.testUser.name || item.testUser.email || item.testUser.phone}
                      </p>
                      <p className="text-xs text-[#64748B]">Current node: {item.currentNode}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={item.status} />
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Clock className="h-3 w-3" />
                        {new Date(item.lastActionAt).toLocaleTimeString()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#CBD5F5]"
                        onClick={() => onViewExecutionLog(item.testUser.id)}
                      >
                        View details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[#E2E8F0] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0F172A]">
            <Clock className="h-5 w-5 text-sky-600" />
            Recent execution log
          </CardTitle>
          <p className="text-sm text-[#475569]">Latest events for test users enrolled in the journey.</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <div className="space-y-2 text-xs text-[#475569]">
              {executionLogs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-3 text-sm text-[#475569]">
                  No execution log entries yet.
                </p>
              ) : (
                executionLogs.slice(0, 10).map(log => (
                  <div
                    key={`${log.testUserId}-${log.timestamp}-${log.nodeId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0F172A]">{log.nodeName}</p>
                      <p className="text-xs text-[#64748B] capitalize">
                        {log.status} · {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={mapLogStatus(log.status)} />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: JourneyProgress["status"] }) {
  const color =
    status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "failed"
        ? "bg-rose-100 text-rose-700"
        : status === "waiting"
          ? "bg-slate-200 text-slate-600"
          : "bg-sky-100 text-sky-700";
  return (
    <span
      className={cn(
        "inline-flex min-w-[90px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        color,
      )}
    >
      {status}
    </span>
  );
}

function mapLogStatus(status: JourneyExecutionLog["status"]): JourneyProgress["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "waiting";
    default:
      return "running";
  }
}



