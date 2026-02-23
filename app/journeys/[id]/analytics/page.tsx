"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, ListTree } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  AnalyticsFilters,
  FunnelStep,
  JourneyPathSummary,
  NodeMetric,
  TimelinePoint,
} from '@/lib/journey-engine/analytics';

import { AnalyticsFiltersPanel } from './components/AnalyticsFiltersPanel';
import { ExportButton } from './components/ExportButton';
import { FunnelVisualization } from './components/FunnelVisualization';
import { NodePerformanceTable } from './components/NodePerformanceTable';
import { OverviewCards } from './components/OverviewCards';
import { PerformanceTimeline } from './components/PerformanceTimeline';
import { AnalyticsSkeleton } from './components/AnalyticsSkeleton';
import { Skeleton } from '@/components/ui/loading';
import { getWindowStorage } from '@/lib/window-storage';

interface JourneyAnalyticsResponse {
  journey: {
    id: string;
    name: string;
    status: string;
  };
  overview: {
    totalEntered: number;
    active: number;
    completed: number;
    dropped: number;
    goalConversionRate: number;
  };
  nodeMetrics: NodeMetric[];
  timeline: TimelinePoint[];
  funnel: FunnelStep[];
  paths: JourneyPathSummary[];
}

type JourneyAnalyticsState = {
  data: JourneyAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
};

interface CachedAnalyticsPayload {
  data: JourneyAnalyticsResponse;
  cachedAt: number;
}

const buildFiltersStorageKey = (journeyId: string) => `journey:${journeyId}:analytics_filters`;
const buildAnalyticsStorageKey = (journeyId: string, filtersKey: string) =>
  `journey:${journeyId}:analytics:${filtersKey}`;

function normaliseFilters(filters: AnalyticsFilters) {
  return {
    from: filters.from ?? null,
    to: filters.to ?? null,
    status: filters.status ?? null,
    goalAchieved: filters.goalAchieved ?? null,
    segmentId: filters.segmentId ?? null,
  };
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-[#E2F5EA] text-[#1D7A4B] border-[#C5E9D5]',
  PAUSED: 'bg-[#FFF1D6] text-[#9A6A1D] border-[#F7D99E]',
  DRAFT: 'bg-[#ECE8E2] text-[#6F6256] border-[#D8CFC5]',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function JourneyAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const journeyId = params?.id;

  const filtersLoadedRef = useRef(false);

  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const normalisedFilters = useMemo(() => normaliseFilters(filters), [filters]);
  const filtersKey = useMemo(() => JSON.stringify(normalisedFilters), [normalisedFilters]);
  const analyticsStorageKey = useMemo(
    () => (journeyId ? buildAnalyticsStorageKey(journeyId, filtersKey) : null),
    [journeyId, filtersKey]
  );

  const [state, setState] = useState<JourneyAnalyticsState>(() => {
    if (typeof window === 'undefined' || !journeyId || !analyticsStorageKey) {
      return { data: null, loading: true, error: null };
    }
    const storage = getWindowStorage();
    const cached = storage.getJSON<CachedAnalyticsPayload>(analyticsStorageKey);
    if (cached?.data) {
      return { data: cached.data, loading: true, error: null };
    }
    return { data: null, loading: true, error: null };
  });

  // Load persisted filters on first mount
  useEffect(() => {
    if (!journeyId || filtersLoadedRef.current) return;
    if (typeof window === 'undefined') {
      filtersLoadedRef.current = true;
      return;
    }
    const storage = getWindowStorage();
    const stored = storage.getJSON<AnalyticsFilters>(buildFiltersStorageKey(journeyId));
    if (stored) {
      filtersLoadedRef.current = true;
      setFilters(prev => ({ ...prev, ...stored }));
    } else {
      filtersLoadedRef.current = true;
    }
  }, [journeyId]);

  // Persist filters whenever they change
  useEffect(() => {
    if (!journeyId || typeof window === 'undefined' || !filtersLoadedRef.current) return;
    const storage = getWindowStorage();
    storage.setJSON(buildFiltersStorageKey(journeyId), filters);
  }, [journeyId, filters, filtersKey]);

  useEffect(() => {
    if (!journeyId || !filtersLoadedRef.current) return;

    const controller = new AbortController();
    const storage = typeof window !== 'undefined' ? getWindowStorage() : null;

    if (storage && analyticsStorageKey) {
      const cached = storage.getJSON<CachedAnalyticsPayload>(analyticsStorageKey);
      if (cached?.data) {
        setState({ data: cached.data, loading: true, error: null });
      }
    }

    async function fetchAnalytics() {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const searchParams = new URLSearchParams();
        if (filters.from) searchParams.set('from', filters.from);
        if (filters.to) searchParams.set('to', filters.to);
        if (filters.status) searchParams.set('status', filters.status);
        if (filters.goalAchieved) searchParams.set('goalAchieved', filters.goalAchieved);
        if (filters.segmentId) searchParams.set('segmentId', filters.segmentId);

        const query = searchParams.toString();
        const response = await fetch(
          `/api/journeys/${journeyId}/analytics${query ? `?${query}` : ''}`,
          { cache: 'no-store', signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to load analytics');
        }

        const payload = (await response.json()) as JourneyAnalyticsResponse;
        setState({ data: payload, loading: false, error: null });
         if (storage && analyticsStorageKey) {
          storage.setJSON(analyticsStorageKey, {
            data: payload,
            cachedAt: Date.now(),
          } satisfies CachedAnalyticsPayload);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          data: null,
          loading: false,
          error: getErrorMessage(error, 'Failed to load analytics'),
        });
      }
    }

    fetchAnalytics();

    return () => controller.abort();
  }, [journeyId, analyticsStorageKey, filters.from, filters.to, filters.status, filters.goalAchieved, filters.segmentId]);

  if (!journeyId) {
    return <div className="p-6 text-sm text-[#8B7F76]">Journey not found.</div>;
  }

  if (state.loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#4A4139]">
        <header className="border-b border-[#E8E4DE] bg-white/70 px-6 py-6 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-8 w-64 max-w-full rounded-xl" />
              <Skeleton className="h-4 w-56 max-w-full rounded-xl" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </header>
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="space-y-4 rounded-3xl border border-[#F2C7C7] bg-white px-8 py-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-[#B45151]">Unable to load analytics</h2>
          <p className="text-sm text-[#8B7F76]">{state.error || 'Please try again later.'}</p>
          <Button variant="outline" className="border-[#E8E4DE] text-[#4A4139]" asChild>
            <Link href="/journeys">Back to Journeys</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#4A4139]">
      <header className="border-b border-[#E8E4DE] bg-white/85 px-4 py-4 backdrop-blur sm:px-6 sm:py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#8B7F76] hover:bg-[#F6F1EB] hover:text-[#4A4139] shrink-0"
                asChild
              >
                <Link href="/journeys">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Link>
              </Button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#B9AA9F] sm:text-[11px]">
                  Journey Analytics
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-[#3A3028] truncate sm:text-2xl lg:text-3xl">{data.journey.name}</h1>
                <p className="text-xs text-[#8B7F76] hidden sm:block sm:text-sm">
                  Real-time visibility into customer flow, performance, and outcomes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge
                className={cn(
                  'border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] sm:px-3 sm:py-1 sm:text-xs',
                  statusStyles[data.journey.status] || 'bg-[#ECE8E2] text-[#6F6256] border-[#D8CFC5]'
                )}
              >
                {data.journey.status}
              </Badge>
              <ExportButton
                journeyName={data.journey.name}
                overview={data.overview}
                timeline={data.timeline}
                nodeMetrics={data.nodeMetrics}
              />
              <Button
                variant="outline"
                size="sm"
                className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F6F1EB] text-xs sm:text-sm"
                asChild
              >
                <Link href={`/journeys/${data.journey.id}/builder`}>Open Builder</Link>
              </Button>
            </div>
          </div>

          <OverviewCards overview={data.overview} timeline={data.timeline} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:gap-8 sm:px-6 sm:py-10">
        <section className="grid gap-4 grid-cols-1 sm:gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-[#E8E4DE] bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#3A3028] sm:text-lg">Funnel overview</h2>
                <p className="text-xs text-[#8B7F76] sm:text-sm">Track movement between steps and identify bottlenecks.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#8B7F76] sm:text-xs">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Last updated just now
              </div>
            </div>
            <div className="overflow-x-auto">
              <FunnelVisualization steps={data.funnel} total={data.overview.totalEntered} />
            </div>
          </div>

          <AnalyticsFiltersPanel filters={filters} onChange={setFilters} isLoading={state.loading} />
        </section>

        <PerformanceTimeline data={data.timeline} />

        <section className="grid gap-4 grid-cols-1 sm:gap-6 xl:grid-cols-[3fr_2fr]">
          <div className="overflow-x-auto">
            <NodePerformanceTable metrics={data.nodeMetrics} />
          </div>

          <div className="rounded-2xl border border-[#E8E4DE] bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#3A3028] sm:text-lg">Journey paths</h2>
                <p className="text-xs text-[#8B7F76] sm:text-sm">Most common customer flows across the journey.</p>
              </div>
              <ListTree className="h-4 w-4 text-[#CBB9A8] sm:h-5 sm:w-5" />
            </div>
            <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-5">
              {data.paths.length ? (
                data.paths.map(path => (
                  <div
                    key={path.id}
                    className="rounded-xl border border-[#E8E4DE] bg-[#F6F1EB]/70 p-3 shadow-inner sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8B7F76] sm:text-xs">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6F6256] sm:px-3 sm:py-1 sm:text-[11px]">
                        Path #{path.rank}
                      </span>
                      <span>•</span>
                      <span>{path.percentage}% of customers</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#4A4139] sm:mt-3 sm:gap-2 sm:text-sm">
                      {path.steps.map((step, index) => (
                        <span key={`${path.id}-${step}-${index}`} className="flex items-center gap-1.5 sm:gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 shadow-sm text-[10px] sm:px-3 sm:py-1 sm:text-sm">{step}</span>
                          {index < path.steps.length - 1 ? (
                            <span className="text-[#B9AA9F]">→</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#E0D8CF] bg-white/70 p-4 text-center text-xs text-[#8B7F76] sm:rounded-2xl sm:p-6 sm:text-sm">
                  Not enough customer paths to display yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

