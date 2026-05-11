'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Mail,
  Eye,
  MousePointerClick,
  AlertTriangle,
  Send as SendIcon,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface TopCampaign {
  id: string;
  name: string;
  subject: string;
  completedAt: string | null;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
}

interface TimeseriesPoint {
  day: string;
  type: string;
  count: number;
}

interface Summary {
  range: { days: number; since: string };
  totals: {
    campaigns: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    bounceRate: number;
    complaintRate: number;
    deliveryRate: number;
  };
  eventCounts: Record<string, number>;
  topCampaigns: TopCampaign[];
  timeseries: TimeseriesPoint[];
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const RANGES: Array<{ value: '7d' | '30d' | '90d'; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export default function EmailAnalyticsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/analytics/summary?range=${range}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.totals) {
        throw new Error(data?.error ?? 'Failed to load analytics');
      }
      setSummary(data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Roll the timeseries into a day-by-day chart with 4 series
  const chartData = useMemo(() => {
    if (!summary) return [];
    const byDay = new Map<string, Record<string, number | string>>();
    for (const point of summary.timeseries) {
      const row = byDay.get(point.day) ?? { day: point.day };
      const key = point.type.toLowerCase();
      row[key] = ((row[key] as number) ?? 0) + point.count;
      byDay.set(point.day, row);
    }
    // Sort by day asc, fill missing series with 0
    const sorted = Array.from(byDay.values()).sort((a, b) =>
      String(a.day).localeCompare(String(b.day)),
    );
    return sorted.map(d => ({
      day: d.day,
      sent: d.sent ?? 0,
      delivered: d.delivered ?? 0,
      opened: d.opened ?? 0,
      clicked: d.clicked ?? 0,
    }));
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!summary) return null;

  const hasData = summary.totals.sent > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aggregate performance across {summary.totals.campaigns} completed campaign
            {summary.totals.campaigns === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                range === r.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
          No email data yet. Once you{' '}
          <Link href="/email/campaigns/new" className="underline font-medium">
            send your first campaign
          </Link>
          , metrics will appear here. Engagement events (opens, clicks, bounces) arrive via
          the Resend webhook at <code>/api/email/webhooks/resend</code> — set
          <code className="mx-1">RESEND_WEBHOOK_SECRET</code> and configure the webhook URL
          in your Resend dashboard.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={SendIcon}
          label="Total Sent"
          value={summary.totals.sent.toLocaleString()}
          accent="gray"
        />
        <StatCard
          icon={Eye}
          label="Open Rate"
          value={`${summary.rates.openRate.toFixed(1)}%`}
          subtitle={`${summary.totals.opened.toLocaleString()} opens`}
          accent="green"
        />
        <StatCard
          icon={MousePointerClick}
          label="Click Rate"
          value={`${summary.rates.clickRate.toFixed(1)}%`}
          subtitle={`${summary.totals.clicked.toLocaleString()} clicks`}
          accent="indigo"
        />
        <StatCard
          icon={AlertTriangle}
          label="Bounce Rate"
          value={`${summary.rates.bounceRate.toFixed(2)}%`}
          subtitle={`${summary.totals.bounced.toLocaleString()} bounced`}
          accent={summary.rates.bounceRate > 5 ? 'red' : 'gray'}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Engagement Over Time
        </h2>
        {chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-sm text-gray-400">
            No engagement events in this time range yet.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="delivered"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Delivered"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="opened"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Opened"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="clicked"
                  stroke="#6366f1"
                  strokeWidth={2}
                  name="Clicked"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">Recent Campaigns</h2>
        </div>
        {summary.topCampaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No completed campaigns yet.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open Rate
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Click Rate
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bounces
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.topCampaigns.map(c => {
                const openRate = c.sentCount > 0 ? (c.openedCount / c.sentCount) * 100 : 0;
                const clickRate = c.sentCount > 0 ? (c.clickedCount / c.sentCount) * 100 : 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/email/campaigns/${c.id}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {c.subject}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {c.sentCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {openRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {clickRate.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {c.bouncedCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = 'gray',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accent?: 'gray' | 'green' | 'indigo' | 'red';
}) {
  const accentClasses: Record<string, string> = {
    gray: 'text-gray-700 bg-gray-100',
    green: 'text-green-700 bg-green-100',
    indigo: 'text-indigo-700 bg-indigo-100',
    red: 'text-red-700 bg-red-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('p-2 rounded-lg', accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
