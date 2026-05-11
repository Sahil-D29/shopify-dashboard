"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loading';
import type { JourneyAnalyticsResponse, JourneyAnalyticsFilters } from '@/lib/types/analytics';
import { OverviewTab } from './OverviewTab';
import { PerformanceTab } from './PerformanceTab';
import { AudienceTab } from './AudienceTab';
import { GoalsTab } from './GoalsTab';
import { ExperimentsTab } from './ExperimentsTab';
import { UserExplorerTab } from './UserExplorerTab';

interface AnalyticsDashboardProps {
  journeyId: string;
}

type TabId = 'overview' | 'performance' | 'audience' | 'goals' | 'experiments' | 'users';

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  performance: 'Performance',
  audience: 'Audience',
  goals: 'Goals & Funnel',
  experiments: 'Experiments',
  users: 'User Explorer',
};

type RangePreset = '30d' | '90d' | 'all';

export function AnalyticsDashboard({ journeyId }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [range, setRange] = useState<RangePreset>('30d');

  const filters = useMemo<JourneyAnalyticsFilters>(() => {
    if (range === 'all') return {};
    const days = range === '30d' ? 30 : 90;
    const base = new Date();
    base.setDate(base.getDate() - days);
    return { from: base.toISOString() };
  }, [range]);

  const query = useQuery({
    queryKey: ['journey-analytics', journeyId, filters],
    queryFn: async (): Promise<JourneyAnalyticsResponse> => {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      if (filters.goalAchieved) params.set('goalAchieved', filters.goalAchieved);
      if (filters.segmentId) params.set('segmentId', filters.segmentId);

      const response = await fetch(`/api/journeys/${journeyId}/analytics${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      return response.json();
    },
    enabled: Boolean(journeyId),
    staleTime: 1000 * 60,
  });

  const { data, isLoading, isFetching, error, refetch } = query;

  const renderContent = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            metrics={data.overview}
            timeline={data.timeline}
            messagePerformance={data.messagePerformance}
            paths={data.paths}
          />
        );
      case 'performance':
        return (
          <PerformanceTab nodePerformance={data.nodePerformance} messagePerformance={data.messagePerformance} />
        );
      case 'audience':
        return (
          <AudienceTab
            segments={data.audience.segments}
            geography={data.audience.geography}
            devices={data.audience.devices}
            cohorts={data.audience.cohorts}
          />
        );
      case 'goals':
        return <GoalsTab funnel={data.funnel} timeline={data.timeline} />;
      case 'experiments':
        return <ExperimentsTab experiments={data.experiments} />;
      case 'users':
        return <UserExplorerTab users={data.users} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Journey Analytics</h2>
          <p className="text-sm text-slate-500">
            Journey: <span className="font-medium text-slate-700">{data?.journey.name ?? 'Loading…'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-slate-200 p-1">
            {(['30d', '90d', 'all'] as RangePreset[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-full px-3 py-1 text-sm ${
                  range === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option === '30d' ? 'Last 30 days' : option === '90d' ? 'Last 90 days' : 'All time'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_LABELS) as TabId[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-8 rounded-full" />
          <Skeleton className="h-[300px] rounded-3xl" />
          <Skeleton className="h-[260px] rounded-3xl" />
        </div>
      ) : error ? (
        <Card className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {error instanceof Error ? error.message : 'Something went wrong while loading analytics.'}
        </Card>
      ) : (
        <div className="flex-1 overflow-auto pb-6">{renderContent()}</div>
      )}
    </div>
  );
}


