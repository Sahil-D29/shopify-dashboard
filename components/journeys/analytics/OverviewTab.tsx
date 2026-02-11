"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  JourneyMetrics,
  TimelinePoint,
  MessagePerformance,
  JourneyPathSummary,
} from '@/lib/types/analytics';
import { MetricCard } from './MetricCard';
import { LineChart } from './charts/LineChart';
import { formatNumber, formatPercent, formatHours } from './utils';

interface OverviewTabProps {
  metrics: JourneyMetrics;
  timeline: TimelinePoint[];
  messagePerformance: MessagePerformance[];
  paths: JourneyPathSummary[];
}

export function OverviewTab({ metrics, timeline, messagePerformance, paths }: OverviewTabProps) {
  const whatsapp = messagePerformance.find(item => item.channel === 'whatsapp');

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Entries" value={formatNumber(metrics.totalEntries)} />
        <MetricCard label="Active Users" value={formatNumber(metrics.activeUsers)} />
        <MetricCard label="Completed Journeys" value={formatNumber(metrics.completedJourneys)} />
        <MetricCard
          label="Goal Conversion"
          value={formatPercent(metrics.conversionRate)}
          deltaLabel="conversion rate"
        />
        <MetricCard
          label="Revenue Generated"
          value={`$${formatNumber(metrics.revenueGenerated ?? 0)}`}
        />
        <MetricCard label="Avg. Completion Time" value={formatHours(metrics.averageCompletionTime)} />
        {whatsapp ? (
          <MetricCard
            label="WhatsApp Delivery"
            value={formatPercent(whatsapp.deliveryRate)}
            deltaLabel="delivery rate"
          />
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Journey Progress</h3>
            <span className="text-sm text-slate-500">Daily entries vs completions</span>
          </div>
          <LineChart data={timeline} />
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Top Paths</h3>
            <span className="text-sm text-slate-500">Most common customer journeys</span>
          </div>
          <div className="space-y-3">
            {paths.length === 0 ? (
              <p className="text-sm text-slate-500">Not enough data available yet.</p>
            ) : (
              paths.map(path => (
                <div
                  key={path.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary" className="rounded-full bg-slate-200 text-slate-700">
                      Path #{path.rank}
                    </Badge>
                    <span className="font-semibold text-slate-700">{formatPercent(path.percentage)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {path.steps.map((step, idx) => (
                      <span key={`${path.id}-${idx}`} className="rounded-full bg-white px-2 py-1 text-xs text-slate-500">
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}


