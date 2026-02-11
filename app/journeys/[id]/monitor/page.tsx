"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  SkipForward,
  XCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { JourneyTemplatePreview } from '@/components/journeys/templates/JourneyTemplatePreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';
import type { JourneyActivityLogRecord, JourneyEnrollmentRecord } from '@/lib/journey-engine/storage';
import type { JourneyDefinition } from '@/lib/types/journey';
import type { JourneyTemplateNode } from '@/lib/types/journey-template';

type MonitorFilter = 'all' | 'active' | 'waiting' | 'completed' | 'failed' | 'exited';

interface JourneyResponse {
  journey: JourneyDefinition;
}

interface EnrollmentResponse {
  total: number;
  page: number;
  pageSize: number;
  data: JourneyEnrollmentRecord[];
}

interface ActivityResponse {
  data: JourneyActivityLogRecord[];
}

interface ApiErrorPayload {
  error?: string;
}

type FailureEntry = {
  attempts?: number;
  lastError?: string;
  lastFailedAt?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

async function fetchJourney(journeyId: string): Promise<JourneyDefinition> {
  const response = await fetch(`/api/journeys/${journeyId}`, { cache: 'no-store' });
  const payload = (await response.json()) as JourneyResponse & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to load journey'));
  }
  return payload.journey;
}

async function fetchEnrollments(journeyId: string, status: MonitorFilter): Promise<EnrollmentResponse> {
  const params = new URLSearchParams({ pageSize: '200' });
  if (status !== 'all') params.set('status', status);
  const response = await fetch(`/api/journeys/${journeyId}/enrollments?${params.toString()}`, {
    cache: 'no-store',
  });
  const payload = (await response.json()) as EnrollmentResponse & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to load enrollments'));
  }
  return payload;
}

async function fetchActivity(journeyId: string): Promise<ActivityResponse> {
  const response = await fetch(`/api/journeys/${journeyId}/activity?limit=50`, { cache: 'no-store' });
  const payload = (await response.json()) as ActivityResponse & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, 'Failed to load activity'));
  }
  return payload;
}

export default function JourneyMonitorPage() {
  const params = useParams<{ id: string }>();
  const journeyId = params?.id;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<MonitorFilter>('active');

  const {
    data: journey,
    isLoading: isJourneyLoading,
    isError: journeyError,
    error: journeyErrorObj,
  } = useQuery<JourneyDefinition, Error>({
    queryKey: ['journey', journeyId],
    queryFn: () => fetchJourney(journeyId!),
    enabled: Boolean(journeyId),
    staleTime: 60_000,
  });

  const {
    data: enrollmentsPayload,
    isLoading: isEnrollmentsLoading,
    isFetching: isEnrollmentsFetching,
    error: enrollmentsError,
  } = useQuery<EnrollmentResponse, Error>({
    queryKey: ['journey-enrollments', journeyId, filter],
    queryFn: () => fetchEnrollments(journeyId!, filter),
    enabled: Boolean(journeyId),
    refetchInterval: 3_000,
  });

  const {
    data: activityPayload,
    isLoading: isActivityLoading,
    error: activityError,
  } = useQuery<ActivityResponse, Error>({
    queryKey: ['journey-activity', journeyId],
    queryFn: () => fetchActivity(journeyId!),
    enabled: Boolean(journeyId),
    refetchInterval: 5_000,
  });

  const enrollments = useMemo(() => enrollmentsPayload?.data ?? [], [enrollmentsPayload]);
  const activity = useMemo(() => activityPayload?.data ?? [], [activityPayload]);

  const skipNodeMutation = useMutation<unknown, Error, string>({
    mutationFn: async (enrollmentId: string) => {
      const response = await fetch(`/api/journeys/enrollments/${enrollmentId}/skip-node`, {
        method: 'POST',
      });
      const payload = (await response.json()) as ApiErrorPayload;
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to skip node'));
      }
      return payload;
    },
    onSuccess: () => {
      toast.success('Node skipped');
      if (journeyId) {
        queryClient.invalidateQueries({ queryKey: ['journey-enrollments', journeyId] });
        queryClient.invalidateQueries({ queryKey: ['journey-activity', journeyId] });
      }
    },
    onError: error => {
      toast.error(error.message ?? 'Unable to skip node');
    },
  });

  const cancelEnrollmentMutation = useMutation<unknown, Error, string>({
    mutationFn: async (enrollmentId: string) => {
      const response = await fetch(`/api/journeys/enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
      });
      const payload = (await response.json()) as ApiErrorPayload;
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to exit enrollment'));
      }
      return payload;
    },
    onSuccess: () => {
      toast.success('Enrollment exited');
      if (journeyId) {
        queryClient.invalidateQueries({ queryKey: ['journey-enrollments', journeyId] });
        queryClient.invalidateQueries({ queryKey: ['journey-activity', journeyId] });
      }
    },
    onError: error => {
      toast.error(error.message ?? 'Unable to exit enrollment');
    },
  });

  const stats = useMemo(() => {
    const base: Record<MonitorFilter, number> = {
      all: enrollments.length,
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      exited: 0,
    };
    enrollments.forEach(enrollment => {
      const status = enrollment.status as MonitorFilter;
      if (status in base) {
        base[status] += 1;
      }
    });
    return base;
  }, [enrollments]);

  const nodeLookup = useMemo(() => {
    if (!journey) return new Map<string, string>();
    return new Map(journey.nodes.map(node => [node.id, String(node.name ?? node.data?.label ?? node.type ?? '')]));
  }, [journey]);

  const previewNodes: JourneyTemplateNode[] = useMemo(() => {
    if (!journey) return [];
    return journey.nodes.map(node => ({
      id: node.id,
      type: node.type,
      subtype: node.subtype,
      name: String(node.name ?? node.data?.label ?? node.type ?? ''),
      description: node.description,
    }));
  }, [journey]);

  const previewTrigger = useMemo<JourneyTemplateNode | undefined>(
    () => previewNodes.find(node => node.type === 'trigger'),
    [previewNodes]
  );

  const isLoading = isJourneyLoading || isEnrollmentsLoading || isActivityLoading;
  const hasError = journeyError || Boolean(enrollmentsError) || Boolean(activityError);
  const errorMessage = journeyErrorObj?.message ?? enrollmentsError?.message ?? activityError?.message;

  const handleManualRefresh = () => {
    if (!journeyId) return;
    queryClient.invalidateQueries({ queryKey: ['journey-enrollments', journeyId] });
    queryClient.invalidateQueries({ queryKey: ['journey-activity', journeyId] });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#4A4139]">
      <header className="border-b border-[#E8E4DE] bg-white/85 px-6 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="ghost" className="text-[#8B7F76] hover:text-[#4A4139]" asChild>
                <Link href={`/journeys/${journeyId}/builder`}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Builder
                </Link>
              </Button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B9AA9F]">Live Monitor</p>
                <h1 className="text-3xl font-semibold tracking-tight text-[#3A3028]">
                  {journey?.name ?? 'Journey Monitor'}
                </h1>
                <p className="text-sm text-[#8B7F76]">Real-time view of customer progress and manual controls.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]"
                onClick={handleManualRefresh}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isEnrollmentsFetching && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        {hasError ? (
          <div className="rounded-3xl border border-[#F2C7C7] bg-white px-6 py-4 text-sm text-[#B45151]">
            {errorMessage ?? 'Unable to load live monitor'}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid place-items-center rounded-3xl border border-[#E8E4DE] bg-white py-16 text-[#8B7F76]">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Loading live monitor…</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MonitorCard
                title="Currently Active"
                value={stats.active}
                description="Customers moving through nodes"
                icon={Zap}
                accent="from-[#CBB097] to-[#B18C6D]"
              />
              <MonitorCard
                title="Waiting / Delayed"
                value={stats.waiting}
                description="Queued for delays or events"
                icon={Pause}
                accent="from-[#D9C9BA] to-[#A88972]"
              />
              <MonitorCard
                title="Completed"
                value={stats.completed}
                description="Reached journey goal"
                icon={Play}
                accent="from-[#BFD7B5] to-[#8DAE7C]"
              />
              <MonitorCard
                title="Exited / Failed"
                value={stats.failed + stats.exited}
                description="Left journey before completion"
                icon={Activity}
                accent="from-[#F1D0C5] to-[#C8998F]"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card className="border-[#E8E4DE] bg-white/90 shadow-sm">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-[#3A3028]">Live Enrollments</CardTitle>
                    <p className="text-sm text-[#8B7F76]">
                      Polling every 3s for active customers. Use actions to intervene manually.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'active', 'waiting', 'completed', 'failed', 'exited'] as MonitorFilter[]).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFilter(option)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition',
                          filter === option
                            ? 'border-[#B8875C] bg-[#F6F1EB] text-[#B8875C]'
                            : 'border-[#E8E4DE] bg-white text-[#8B7F76] hover:border-[#D4A574] hover:text-[#B8875C]'
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F6F1EB] text-[11px] uppercase tracking-[0.2em] text-[#8B7F76]">
                          <TableHead className="px-6 py-3">Customer</TableHead>
                          <TableHead className="px-6 py-3">Status</TableHead>
                          <TableHead className="px-6 py-3">Current Node</TableHead>
                          <TableHead className="px-6 py-3">Time In Node</TableHead>
                          <TableHead className="px-6 py-3 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-sm text-[#8B7F76]">
                              No enrollments match this filter right now.
                            </TableCell>
                          </TableRow>
                        ) : (
                          enrollments.map(enrollment => {
                            const failureMap = isRecord(enrollment.metadata?.failures)
                              ? (enrollment.metadata?.failures as Record<string, FailureEntry>)
                              : {};
                            const attemptCount = Object.values(failureMap).reduce(
                              (max, entry) => Math.max(max, Number(entry?.attempts ?? 0)),
                              0
                            );
                            const latestFailure = Object.values(failureMap).reduce(
                              (latest, entry) => {
                                if (!entry?.lastFailedAt) return latest;
                                if (!latest?.lastFailedAt) return entry;
                                return Date.parse(entry.lastFailedAt) > Date.parse(latest.lastFailedAt) ? entry : latest;
                              },
                              undefined as { attempts?: number; lastError?: string; lastFailedAt?: string } | undefined
                            );
                            const nodeLabel =
                              (enrollment.currentNodeId ? nodeLookup.get(enrollment.currentNodeId) : null) ??
                              enrollment.currentNodeId ??
                              '—';
                            const timeInNode = enrollment.lastActivityAt
                              ? formatDistanceToNow(new Date(enrollment.lastActivityAt), { addSuffix: true })
                              : '—';

                            return (
                              <TableRow key={enrollment.id} className="border-b border-[#F0EAE1] text-sm">
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-[#4A4139]">{enrollment.customerId}</span>
                                    <span className="text-xs text-[#8B7F76]">
                                      {enrollment.customerEmail || enrollment.customerPhone || '—'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                    <Badge className="w-fit border-[#E8E4DE] bg-[#FAF9F6] text-[#8B7F76]">
                                      {enrollment.status.toUpperCase()}
                                    </Badge>
                                    {attemptCount > 0 ? (
                                      <span className="text-[11px] text-[#B45151]">
                                        {attemptCount} retry{attemptCount === 1 ? '' : 's'}
                                        {latestFailure?.lastError
                                          ? ` · ${latestFailure.lastError.slice(0, 48)}${
                                              latestFailure.lastError.length > 48 ? '...' : ''
                                            }`
                                          : ''}
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-[#4A4139]">{nodeLabel}</TableCell>
                                <TableCell className="px-6 py-4 text-xs text-[#8B7F76]">{timeInNode}</TableCell>
                                <TableCell className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {(enrollment.status === 'active' || enrollment.status === 'waiting') && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-[#E8E4DE] text-[#8B7F76] hover:text-[#B8875C]"
                                          disabled={skipNodeMutation.isPending}
                                          onClick={() => skipNodeMutation.mutate(enrollment.id)}
                                        >
                                          <SkipForward className="mr-1 h-4 w-4" />
                                          Skip
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="bg-[#F6D9D4] text-[#B45151] hover:bg-[#F1C2B8]"
                                          disabled={cancelEnrollmentMutation.isPending}
                                          onClick={() => {
                                            if (
                                              confirm(
                                                'Exit this customer from the journey? They will not continue through remaining nodes.'
                                              )
                                            ) {
                                              cancelEnrollmentMutation.mutate(enrollment.id);
                                            }
                                          }}
                                        >
                                          <XCircle className="mr-1 h-4 w-4" />
                                          Exit
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-[#E8E4DE] bg-white/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">
                      Journey Map
                    </CardTitle>
                    <p className="text-xs text-[#8B7F76]">
                      Snapshot of the current journey flow for quick reference.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <JourneyTemplatePreview trigger={previewTrigger} nodes={previewNodes} className="h-48" />
                  </CardContent>
                </Card>

                <Card className="border-[#E8E4DE] bg-white/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B8977F]">
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activity.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-3 py-6 text-center text-xs text-[#8B7F76]">
                        No activity recorded yet.
                      </div>
                    ) : (
                      activity.slice(0, 20).map(log => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-[#E8E4DE] bg-[#FAF9F6] px-3 py-2 text-xs text-[#4A4139]"
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">
                            <span>{log.eventType.replace(/_/g, ' ')}</span>
                            <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#8B7F76]">
                            {log.enrollmentId ? `Enrollment ${log.enrollmentId}` : ''}
                          </div>
                          {log.data?.message != null ? (
                            <div className="mt-1 text-[11px] text-[#937C6D]">{String(log.data.message)}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MonitorCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-3xl border border-[#E8E4DE] bg-gradient-to-br p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        accent
      )}
    >
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">{title}</p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-white/70">{description}</p>
        </div>
        <div className="rounded-2xl bg-white/30 p-3 text-white">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

