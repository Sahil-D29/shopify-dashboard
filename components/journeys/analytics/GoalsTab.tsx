"use client";

import { Card } from '@/components/ui/card';
import type { GoalFunnelStep, TimelinePoint } from '@/lib/types/analytics';
import { LineChart } from './charts/LineChart';
import { formatNumber, formatPercent } from './utils';

interface GoalsTabProps {
  funnel: GoalFunnelStep[];
  timeline: TimelinePoint[];
}

export function GoalsTab({ funnel, timeline }: GoalsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Goal Funnel</h3>
            <p className="text-sm text-slate-500">Track drop-off across your key steps</p>
          </div>
          {funnel.length === 0 ? (
            <p className="text-sm text-slate-500">No goal data available yet.</p>
          ) : (
            <div className="space-y-4">
              {funnel.map(step => (
                <div key={step.nodeId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{step.name}</span>
                    <span>{formatPercent(step.conversionRate)}</span>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatNumber(step.users)} users</span>
                    <span>{formatNumber(step.conversions)} conversions</span>
                  </div>
                  <div className="h-2 rounded-full bg-white">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(step.conversionRate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Conversions Over Time</h3>
            <p className="text-sm text-slate-500">Goal completions by day</p>
          </div>
          <LineChart
            data={timeline.map(point => ({
              ...point,
              started: 0, // hide started series for this chart
            }))}
            height={220}
          />
        </Card>
      </section>
    </div>
  );
}


