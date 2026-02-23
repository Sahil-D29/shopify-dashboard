"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight, BarChart3, Copy, LayoutGrid, List, Pause, Play, Plus,
  Search, SortAsc, Sparkles, Target, Trash2, TrendingUp
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
type SortOption = 'newest' | 'oldest' | 'most_enrolled' | 'highest_conversion';
type ViewMode = 'grid' | 'list';

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

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'Most Enrolled', value: 'most_enrolled' },
  { label: 'Highest Conversion', value: 'highest_conversion' },
];

export default function JourneysPage() {
  const router = useRouter();
  const toast = useToast();
  const [journeys, setJourneys] = useState<JourneyDefinition[]>([]);
  const [journeyMetrics, setJourneyMetrics] = useState<Record<string, JourneyMetrics | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
  }, [journeysWithMetrics]);

  const filteredJourneys = useMemo(() => {
    let result = journeysWithMetrics.filter(journey => {
      const triggerNode = journey.nodes.find(node => node.type === 'trigger');
      const triggerType = triggerNode?.subtype || triggerNode?.type;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = journey.name?.toLowerCase().includes(q);
        const matchesDesc = journey.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

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

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'most_enrolled':
          return (b.metrics?.totalEnrolled ?? 0) - (a.metrics?.totalEnrolled ?? 0);
        case 'highest_conversion':
          return (b.metrics?.conversionRate ?? 0) - (a.metrics?.conversionRate ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [journeysWithMetrics, searchQuery, statusFilter, triggerFilter, performanceFilter, sortBy]);

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
      {/* Header */}
      <section className="border-b border-slate-200 bg-white/80 px-4 py-5 backdrop-blur sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:gap-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lifecycle Journeys</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Journey Management</h1>
              <p className="text-sm text-slate-500 hidden sm:block">
                Monitor every lifecycle program, track performance, and launch new experiences.
              </p>
            </div>
            <JourneyActions onJourneyCreated={journey => setJourneys(prev => [journey, ...prev])} />
          </header>

          {/* Stat Cards */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {STAT_CARDS.map(card => {
              const Icon = card.icon;
              const value = totals[card.key as keyof typeof totals] ?? 0;
              return (
                <article
                  key={card.key}
                  className={cn(
                    'relative overflow-hidden rounded-xl p-4 shadow-md shadow-slate-900/5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-2xl sm:p-5',
                    'bg-gradient-to-br text-white',
                    card.gradient
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-white/80 sm:text-xs">{card.title}</p>
                      <p className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">{value}</p>
                    </div>
                    <span className="rounded-full bg-white/15 p-1.5 text-white sm:p-2">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.35), transparent)' }} />
                </article>
              );
            })}
          </section>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">
        {/* Search, Sort & Filter Bar */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
          {/* Search + Sort Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search journeys..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm border-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                <SortAsc className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {/* View Toggle */}
              <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-slate-50/80">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn('p-1.5 rounded-l-lg transition-colors', viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn('p-1.5 rounded-r-lg transition-colors', viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Row */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                { label: 'Top', value: 'top' },
                { label: 'Needs Attention', value: 'needs_attention' },
              ]}
              onChange={setPerformanceFilter}
            />
            {(searchQuery || statusFilter !== 'all' || triggerFilter !== 'all' || performanceFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTriggerFilter('all'); setPerformanceFilter('all'); }}
                className="whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Result Count */}
          {!loading && (
            <p className="mt-2 text-xs text-slate-500">
              {filteredJourneys.length} of {journeysWithMetrics.length} journeys
            </p>
          )}
        </section>

        {/* Journey Cards */}
        {loading ? (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
            ))}
          </div>
        ) : filteredJourneys.length === 0 ? (
          <EmptyState
            hasFilters={searchQuery !== '' || statusFilter !== 'all' || triggerFilter !== 'all' || performanceFilter !== 'all'}
            onClearFilters={() => { setSearchQuery(''); setStatusFilter('all'); setTriggerFilter('all'); setPerformanceFilter('all'); }}
            onJourneyCreated={journey => setJourneys(prev => [journey, ...prev])}
          />
        ) : viewMode === 'grid' ? (
          <section className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filteredJourneys.map(journey => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onStatusChange={updateJourneyStatus}
                onRemove={removeJourney}
                onDuplicated={handleDuplicate}
              />
            ))}
          </section>
        ) : (
          <section className="space-y-3">
            {filteredJourneys.map(journey => (
              <JourneyListRow
                key={journey.id}
                journey={journey}
                onStatusChange={updateJourneyStatus}
                onRemove={removeJourney}
                onDuplicated={handleDuplicate}
              />
            ))}
          </section>
        )}
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
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-2.5 py-1 shadow-sm whitespace-nowrap shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</span>
      <div className="flex items-center gap-0.5">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-3 sm:py-1 sm:text-xs',
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

function EmptyState({
  hasFilters,
  onClearFilters,
  onJourneyCreated,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onJourneyCreated: (journey: JourneyListItem) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4">
        <Sparkles className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">
        {hasFilters ? 'No journeys match your filters' : 'No journeys yet'}
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        {hasFilters
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Create your first automated journey to start engaging customers with personalized WhatsApp experiences.'}
      </p>
      <div className="mt-6 flex gap-3">
        {hasFilters ? (
          <Button variant="outline" onClick={onClearFilters}>Clear Filters</Button>
        ) : (
          <JourneyActions onJourneyCreated={onJourneyCreated} />
        )}
      </div>
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
        return 'Segment';
      case 'event_trigger':
        return 'Event';
      case 'manual_entry':
      case 'manual':
        return 'Manual';
      default:
        return 'Trigger';
    }
  })();

  const totalSteps = journey.nodes.length;
  const conversionRate = journey.metrics?.conversionRate ?? 0;
  const statusBadge = statusStyles[journey.status] || 'bg-slate-100 text-slate-600 border-slate-200';

  const callStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    try {
      setActionLoading(status === 'ACTIVE' ? 'activate' : 'pause');
      const endpoint = status === 'ACTIVE' ? `/api/journeys/${journey.id}/activate` : `/api/journeys/${journey.id}/pause`;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
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
      if (!res.ok || !payload.journey) throw new Error(payload.error ?? 'Failed to duplicate journey');
      onDuplicated({ ...payload.journey, metrics: undefined });
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

  return (
    <article className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-2xl sm:gap-5 sm:p-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/journeys/${journey.id}`} className="text-base font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate sm:text-lg">
              {journey.name}
            </Link>
            <Badge className={cn('border px-2 py-0.5 text-[10px] sm:text-xs shrink-0', statusBadge)}>{journey.status}</Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500 sm:text-sm sm:line-clamp-2">{journey.description || 'Automated journey'}</p>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <MetricBox label="Enrolled" value={(journey.metrics?.totalEnrolled ?? 0).toLocaleString('en-IN')} />
        <MetricBox label="Conversion" value={`${conversionRate}%`} />
        <MetricBox label="Steps" value={totalSteps.toString()} />
        <MetricBox label="Trigger" value={triggerLabel} />
      </div>

      {/* Footer */}
      <footer className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[10px] text-slate-400 sm:text-xs">
          Updated {new Date(journey.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 text-slate-600" asChild>
            <Link href={`/journeys/${journey.id}`}>View</Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 text-slate-600" asChild>
            <Link href={`/journeys/${journey.id}/builder`}>Edit</Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 text-slate-600" asChild>
            <Link href={`/journeys/${journey.id}/analytics`}>
              <BarChart3 className="mr-1 h-3 w-3" />Analytics
            </Link>
          </Button>
          {journey.status === 'ACTIVE' ? (
            <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-600 hover:bg-amber-50" onClick={() => callStatus('PAUSED')} disabled={actionLoading === 'pause'}>
              <Pause className="mr-1 h-3 w-3" />{actionLoading === 'pause' ? '...' : 'Pause'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-xs border-green-300 text-green-600 hover:bg-green-50" onClick={() => callStatus('ACTIVE')} disabled={actionLoading === 'activate'}>
              <Play className="mr-1 h-3 w-3" />{actionLoading === 'activate' ? '...' : 'Activate'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50" onClick={callDuplicate} disabled={actionLoading === 'duplicate'}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={callDelete} disabled={actionLoading === 'delete'}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </footer>
    </article>
  );
}

function JourneyListRow({
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
  const statusBadge = statusStyles[journey.status] || 'bg-slate-100 text-slate-600 border-slate-200';
  const conversionRate = journey.metrics?.conversionRate ?? 0;

  const callStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    try {
      setActionLoading(status === 'ACTIVE' ? 'activate' : 'pause');
      const endpoint = status === 'ACTIVE' ? `/api/journeys/${journey.id}/activate` : `/api/journeys/${journey.id}/pause`;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Failed');
      onStatusChange(journey.id, status);
      toast.success(status === 'ACTIVE' ? 'Journey activated' : 'Journey paused');
    } catch { toast.error('Failed to update status'); }
    finally { setActionLoading(null); }
  };

  const callDuplicate = async () => {
    try {
      setActionLoading('duplicate');
      const res = await fetch(`/api/journeys/${journey.id}/duplicate`, { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.journey) throw new Error('Failed');
      onDuplicated({ ...payload.journey, metrics: undefined });
    } catch { toast.error('Failed to duplicate'); }
    finally { setActionLoading(null); }
  };

  const callDelete = async () => {
    if (!confirm('Delete this journey?')) return;
    try {
      setActionLoading('delete');
      const res = await fetch(`/api/journeys/${journey.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      onRemove(journey.id);
      toast.success('Journey deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/journeys/${journey.id}`} className="font-semibold text-slate-900 hover:text-blue-600 truncate">
            {journey.name}
          </Link>
          <Badge className={cn('border px-2 py-0.5 text-[10px] shrink-0', statusBadge)}>{journey.status}</Badge>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{journey.description || 'Automated journey'}</p>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
        <span><strong>{journey.metrics?.totalEnrolled ?? 0}</strong> enrolled</span>
        <span><strong>{conversionRate}%</strong> conv.</span>
        <span><strong>{journey.nodes.length}</strong> steps</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
          <Link href={`/journeys/${journey.id}/builder`}>Edit</Link>
        </Button>
        {journey.status === 'ACTIVE' ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-600" onClick={() => callStatus('PAUSED')} disabled={!!actionLoading}>
            <Pause className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs border-green-300 text-green-600" onClick={() => callStatus('ACTIVE')} disabled={!!actionLoading}>
            <Play className="h-3 w-3" />
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={callDuplicate} disabled={!!actionLoading}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs border-red-200 text-red-600" onClick={callDelete} disabled={!!actionLoading}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 sm:gap-1 sm:rounded-xl sm:p-3.5">
      <span className="text-[10px] font-medium text-slate-500 sm:text-xs">{label}</span>
      <span className="text-lg font-semibold text-slate-900 sm:text-xl">{value}</span>
    </div>
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
      if (!response.ok || !payload.journey) throw new Error(payload.error ?? 'Failed to create journey');

      onJourneyCreated?.({ ...payload.journey, metrics: undefined });
      toast.success('Journey created');
      router.push(`/journeys/${payload.journey.id}/builder`);
    } catch (error) {
      console.error('Error creating journey:', error);
      toast.error(getErrorMessage(error, 'Failed to create journey'));
    } finally {
      setIsCreating(false);
    }
  }, [onJourneyCreated, router, toast]);

  return (
    <Button
      className="bg-blue-600 px-4 py-2 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 text-sm sm:px-5"
      onClick={handleCreate}
      disabled={isCreating}
    >
      <Plus className="mr-1.5 h-4 w-4" />
      {isCreating ? 'Creating…' : 'Create Journey'}
    </Button>
  );
}
