"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Copy, Pause, Play, Plus, Sparkles, Target, Trash2, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JourneyDefinition } from '@/lib/types/journey';
import { useToast } from '@/lib/hooks/useToast';

interface JourneyMetrics {
  totalEnrolled: number;
  active: number;
  completed: number;
  conversionRate: number;
}

interface JourneyListItem extends JourneyDefinition {
  metrics?: JourneyMetrics;
}

interface JourneyListResponse {
  journeys?: JourneyDefinition[];
  error?: string;
}

interface JourneyAnalyticsSummary {
  metrics?: JourneyMetrics;
  error?: string;
}

interface ApiErrorResponse {
  error?: string;
}

type StatusFilter = 'all' | 'active' | 'paused' | 'draft';
type TriggerFilter = 'all' | 'segment' | 'event' | 'manual';
type PerformanceFilter = 'all' | 'top' | 'needs_attention';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const STAT_CARDS = [
  {
    key: 'total',
    title: 'Total Journeys',
    icon: Sparkles,
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    key: 'active',
    title: 'Active Journeys',
    icon: TrendingUp,
    gradient: 'from-green-500 to-green-600',
  },
  {
    key: 'enrolled',
    title: 'Customers Enrolled',
    icon: Target,
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    key: 'conversion',
    title: 'Avg Conversion Rate',
    icon: ArrowUpRight,
    gradient: 'from-amber-500 to-amber-600',
  },
] as const;

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  PAUSED: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function JourneysPage() {
  const router = useRouter();
  const toast = useToast();
  const [journeys, setJourneys] = useState<JourneyDefinition[]>([]);
  const [journeyMetrics, setJourneyMetrics] = useState<Record<string, JourneyMetrics | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/journeys', { cache: 'no-store' });
        const payload: JourneyListResponse = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load journeys');
        }
        if (!cancelled) {
          setJourneys(payload.journeys ?? []);
        }
      } catch (error) {
        console.error('Failed to load journeys', error);
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Failed to load journeys'));
          setJourneys([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!journeys.length) {
      setJourneyMetrics({});
      return;
    }

    let cancelled = false;
    const ids = journeys.map(j => j.id).join('|');

    const loadAnalytics = async () => {
      try {
        const entries = await Promise.all(
          journeys.map(async journey => {
            try {
              const response = await fetch(`/api/journeys/${journey.id}/analytics`, { cache: 'no-store' });
              if (!response.ok) return [journey.id, undefined] as const;
              const payload: JourneyAnalyticsSummary = await response.json();
              return [journey.id, payload.metrics] as const;
            } catch (error) {
              console.warn('Failed to load analytics for journey', journey.id, error);
              return [journey.id, undefined] as const;
            }
          })
        );

        if (!cancelled) {
          setJourneyMetrics(prev => {
            const next = { ...prev };
            for (const [id, metrics] of entries) {
              next[id] = metrics;
            }
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to load journey analytics', error);
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeys.length, journeys.map(j => j.id).join('|')]);

  const journeysWithMetrics = useMemo<JourneyListItem[]>(() => {
    return journeys.map(journey => ({
      ...journey,
      metrics: journeyMetrics[journey.id],
    }));
  }, [journeys, journeyMetrics]);

  const totals = useMemo(() => {
    const total = journeysWithMetrics.length;
    const active = journeysWithMetrics.filter(j => j.status === 'ACTIVE').length;
    const enrolled = journeysWithMetrics.reduce((sum, journey) => sum + (journey.metrics?.totalEnrolled || 0), 0);
    const conversionRates = journeysWithMetrics
      .map(journey => journey.metrics?.conversionRate || 0)
      .filter(rate => rate > 0);
    const avgConversion = conversionRates.length
      ? Math.round(conversionRates.reduce((a, b) => a + b, 0) / conversionRates.length)
      : 0;

    return {
      total,
      active,
      enrolled,
      conversion: `${avgConversion}%`,
    };
  }, [journeys]);

  const filteredJourneys = useMemo(() => {
    return journeysWithMetrics.filter(journey => {
      const triggerNode = journey.nodes.find(node => node.type === 'trigger');
      const triggerType = triggerNode?.subtype || triggerNode?.type;

      if (statusFilter !== 'all') {
        const targetStatus = statusFilter.toUpperCase();
        if (journey.status !== targetStatus) return false;
      }

      if (triggerFilter !== 'all') {
        if (!triggerType) return false;
        if (triggerFilter === 'segment' && triggerType !== 'segment_joined' && triggerType !== 'segment') return false;
        if (triggerFilter === 'event' && triggerType !== 'event_trigger') return false;
        if (triggerFilter === 'manual' && triggerType !== 'manual_entry' && triggerType !== 'manual') return false;
      }

      if (performanceFilter !== 'all') {
        const conversion = journey.metrics?.conversionRate ?? 0;
        if (performanceFilter === 'top' && conversion < 40) return false;
        if (performanceFilter === 'needs_attention' && conversion >= 40) return false;
      }

      return true;
    });
  }, [journeys, performanceFilter, statusFilter, triggerFilter]);

  const updateJourneyStatus = useCallback((journeyId: string, status: JourneyListItem['status']) => {
    setJourneys(prev =>
      prev.map(j => (j.id === journeyId ? { ...j, status, updatedAt: Date.now() } : j))
    );
  }, []);

  const removeJourney = useCallback((journeyId: string) => {
    setJourneys(prev => prev.filter(j => j.id !== journeyId));
    setJourneyMetrics(prev => {
      const next = { ...prev };
      delete next[journeyId];
      return next;
    });
  }, []);

  const handleDuplicate = useCallback(
    (duplicate: JourneyListItem) => {
      setJourneys(prev => [duplicate, ...prev]);
      setJourneyMetrics(prev => ({
        ...prev,
        [duplicate.id]: duplicate.metrics,
      }));
      toast.success('Journey duplicated');
      router.push(`/journeys/${duplicate.id}/builder`);
    },
    [router, toast]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <section className="border-b border-slate-200 bg-white/80 px-6 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lifecycle Journeys</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Journey Management</h1>
              <p className="text-sm text-slate-500">
                Monitor every lifecycle program, track performance, and launch new experiences in minutes.
              </p>
            </div>
            <JourneyActions onJourneyCreated={journey => setJourneys(prev => [journey, ...prev])} />
          </header>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map(card => {
              const Icon = card.icon;
              const value = totals[card.key as keyof typeof totals] ?? 0;
              return (
                <article
                  key={card.key}
                  className={cn(
                    'relative overflow-hidden rounded-2xl p-5 shadow-md shadow-slate-900/5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                    'bg-gradient-to-br text-white',
                    card.gradient
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/80">{card.title}</p>
                      <p className="mt-2 text-3xl font-semibold">{value}</p>
                    </div>
                    <span className="rounded-full bg-white/15 p-2 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.35), transparent)' }} />
                </article>
              );
            })}
          </section>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Journeys Overview</h2>
              <p className="text-sm text-slate-500">Filter by lifecycle status, entry trigger, or performance to focus on what matters.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <FilterPill
                label="Status"
                value={statusFilter}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Paused', value: 'paused' },
                  { label: 'Draft', value: 'draft' },
                ]}
                onChange={setStatusFilter}
              />
              <FilterPill
                label="Trigger"
                value={triggerFilter}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Segment', value: 'segment' },
                  { label: 'Event', value: 'event' },
                  { label: 'Manual', value: 'manual' },
                ]}
                onChange={setTriggerFilter}
              />
              <FilterPill
                label="Performance"
                value={performanceFilter}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Top performing', value: 'top' },
                  { label: 'Needs attention', value: 'needs_attention' },
                ]}
                onChange={setPerformanceFilter}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <PlaceholderCard title="Loading journeys" description="Pulling real-time performance data from the journey engine." />
          ) : filteredJourneys.length === 0 ? (
            <div className="col-span-full">
              <PlaceholderCard
                title="No journeys match your filters"
                description="Try adjusting your filters or create a new journey to start engaging customers."
              />
            </div>
          ) : (
            filteredJourneys.map(journey => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onStatusChange={updateJourneyStatus}
                onRemove={removeJourney}
                onDuplicated={handleDuplicate}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === option.value
                ? 'bg-white text-slate-900 shadow'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">{description}</p>
    </div>
  );
}

function JourneyCard({
  journey,
  onStatusChange,
  onRemove,
  onDuplicated,
}: {
  journey: JourneyListItem;
  onStatusChange: (journeyId: string, status: JourneyListItem['status']) => void;
  onRemove: (journeyId: string) => void;
  onDuplicated: (journey: JourneyListItem) => void;
}) {
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState<'activate' | 'pause' | 'duplicate' | 'delete' | null>(null);
  const triggerNode = journey.nodes.find(node => node.type === 'trigger');
  const triggerLabel = (() => {
    switch (triggerNode?.subtype || triggerNode?.type) {
      case 'segment_joined':
      case 'segment':
        return 'Segment Trigger';
      case 'event_trigger':
        return 'Event Trigger';
      case 'manual_entry':
      case 'manual':
        return 'Manual Enrollment';
      default:
        return 'Trigger';
    }
  })();

  const totalSteps = journey.nodes.length;
  const activeEdges = journey.edges.length;
  const conversionRate = journey.metrics?.conversionRate ?? 0;
  const statusBadge = statusStyles[journey.status] || 'bg-slate-100 text-slate-600 border-slate-200';

  const callStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    try {
      setActionLoading(status === 'ACTIVE' ? 'activate' : 'pause');
      const endpoint = status === 'ACTIVE' ? `/api/journeys/${journey.id}/activate` : `/api/journeys/${journey.id}/pause`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(payload.error ?? 'Failed to update journey status');
      }
      onStatusChange(journey.id, status);
      toast.success(status === 'ACTIVE' ? 'Journey activated' : 'Journey paused');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update journey status'));
    } finally {
      setActionLoading(null);
    }
  };

  const callDuplicate = async () => {
    try {
      setActionLoading('duplicate');
      const res = await fetch(`/api/journeys/${journey.id}/duplicate`, { method: 'POST' });
      const payload = (await res.json().catch(() => ({}))) as { journey?: JourneyDefinition } & ApiErrorResponse;
      if (!res.ok || !payload.journey) {
        throw new Error(payload.error ?? 'Failed to duplicate journey');
      }
      const cloned: JourneyListItem = {
        ...payload.journey,
        metrics: undefined,
      };
      onDuplicated(cloned);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to duplicate journey'));
    } finally {
      setActionLoading(null);
    }
  };

  const callDelete = async () => {
    if (!confirm('Delete this journey? This cannot be undone.')) return;
    try {
      setActionLoading('delete');
      const res = await fetch(`/api/journeys/${journey.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(payload.error ?? 'Failed to delete journey');
      }
      onRemove(journey.id);
      toast.success('Journey deleted');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete journey'));
    } finally {
      setActionLoading(null);
    }
  };
  const metricsGrid = [
    {
      key: 'customers',
      label: 'Customers Enrolled',
      value: (journey.metrics?.totalEnrolled ?? 0).toLocaleString('en-IN'),
    },
    {
      key: 'conversion',
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
    },
    {
      key: 'steps',
      label: 'Steps',
      value: totalSteps.toString(),
    },
    {
      key: 'connections',
      label: 'Connections',
      value: activeEdges.toString(),
    },
  ];

  return (
    <article className="group flex min-h-[280px] min-w-[320px] flex-col gap-5 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{journey.name}</h3>
            <Badge className={cn('border px-2 py-0.5 text-xs', statusBadge)}>{journey.status}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{journey.description || 'Automated journey'}</p>
        </div>
        <Button
          variant="outline"
          className="border-slate-200 text-slate-600 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-600"
          asChild
        >
          <Link href={`/journeys/${journey.id}/builder`}>Open Builder</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {metricsGrid.map(metric => (
          <div
            key={metric.key}
            className="flex min-h-[96px] flex-col justify-between gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4"
          >
            <span className="text-sm font-medium leading-snug text-slate-600">{metric.label}</span>
            <span className="text-2xl font-semibold leading-tight text-slate-900">{metric.value}</span>
          </div>
        ))}
      </div>

      <footer className="flex flex-col gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">{triggerLabel}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            Updated {new Date(journey.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button variant="outline" className="border-slate-200 text-slate-600 hover:border-slate-300" asChild>
            <Link href={`/journeys/${journey.id}/analytics`}>Analytics</Link>
          </Button>
          <Button variant="outline" className="border-slate-200 text-slate-600 hover:border-slate-300" asChild>
            <Link href={`/journeys/${journey.id}/builder`}>Edit</Link>
          </Button>
          {journey.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              className="border-amber-300 text-amber-600 hover:bg-amber-50"
              onClick={() => callStatus('PAUSED')}
              disabled={actionLoading === 'pause'}
            >
              {actionLoading === 'pause' ? 'Pausing…' : (<><Pause className="mr-1 h-3.5 w-3.5" />Pause</>)}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-green-300 text-green-600 hover:bg-green-50"
              onClick={() => callStatus('ACTIVE')}
              disabled={actionLoading === 'activate'}
            >
              {actionLoading === 'activate' ? 'Activating…' : (<><Play className="mr-1 h-3.5 w-3.5" />Activate</>)}
            </Button>
          )}
          <Button
            variant="outline"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={callDuplicate}
            disabled={actionLoading === 'duplicate'}
          >
            {actionLoading === 'duplicate' ? 'Duplicating…' : (<><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</>)}
          </Button>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={callDelete}
            disabled={actionLoading === 'delete'}
          >
            {actionLoading === 'delete' ? 'Deleting…' : (<><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</>)}
          </Button>
        </div>
      </footer>
    </article>
  );
}

function JourneyActions({
  onJourneyCreated,
}: {
  onJourneyCreated?: (journey: JourneyListItem) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Journey' }),
      });

      const payload = (await response.json().catch(() => ({}))) as { journey?: JourneyDefinition } & ApiErrorResponse;
      if (!response.ok || !payload.journey) {
        throw new Error(payload.error ?? 'Failed to create journey');
      }
      const journey = payload.journey;

      onJourneyCreated?.({
        ...journey,
        metrics: undefined,
      });

      toast.success('Journey created');
      router.push(`/journeys/${journey.id}/builder`);
    } catch (error) {
      console.error('Error creating journey:', error);
      toast.error(getErrorMessage(error, 'Failed to create journey'));
    } finally {
      setIsCreating(false);
    }
  }, [onJourneyCreated, router, toast]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        className="bg-blue-600 px-5 py-2 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
        onClick={handleCreate}
        disabled={isCreating}
      >
        <Plus className="mr-2 h-4 w-4" />
        {isCreating ? 'Creating…' : 'Create Journey'}
      </Button>
    </div>
  );
}
