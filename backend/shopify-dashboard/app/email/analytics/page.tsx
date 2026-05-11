'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Send,
  Eye,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  UserMinus,
  Mail,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  color?: string;
  trend?: number;
}

function MetricCard({ label, value, suffix, icon: Icon, color = 'text-gray-900', trend }: MetricCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="rounded-lg bg-gray-100 p-2">
            <Icon className="h-5 w-5 text-gray-600" />
          </div>
          {typeof trend === 'number' && trend !== 0 && (
            <div className={cn('flex items-center gap-1 text-xs font-semibold', trend > 0 ? 'text-green-600' : 'text-rose-500')}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className={cn('text-2xl font-bold', color)}>
          {value}{suffix}
        </p>
      </div>
    </div>
  );
}

interface OverviewData {
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    uniqueOpens: number;
    uniqueClicks: number;
  };
  openRate: string;
  clickRate: string;
  bounceRate: string;
  daily: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>;
}

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: string;
  clickRate: string;
  bounceRate: string;
}

export default function EmailAnalyticsPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      if (campaignId) {
        const res = await fetch(`${EMAIL_API}/analytics/campaign/${campaignId}`);
        if (res.ok) {
          const data = await res.json();
          setCampaignMetrics(data.metrics);
        }
      }

      const endDate = new Date().toISOString();
      const startDate = new Date();
      if (dateRange === '7d') startDate.setDate(startDate.getDate() - 7);
      else if (dateRange === '30d') startDate.setDate(startDate.getDate() - 30);
      else startDate.setDate(startDate.getDate() - 90);

      const res = await fetch(
        `${EMAIL_API}/analytics/overview?startDate=${startDate.toISOString()}&endDate=${endDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setOverview(data.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const metrics = campaignMetrics || overview?.totals || {
    sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, uniqueOpens: 0, uniqueClicks: 0,
  };
  const daily = overview?.daily || [];

  const pieData = [
    { name: 'Opened', value: Number(metrics.opened) || 0 },
    { name: 'Clicked', value: Number(metrics.clicked) || 0 },
    { name: 'Bounced', value: Number(metrics.bounced) || 0 },
    { name: 'Unsubscribed', value: Number(metrics.unsubscribed) || 0 },
  ].filter((d) => d.value > 0);

  const openRate = campaignMetrics?.openRate || overview?.openRate || '0.00';
  const clickRate = campaignMetrics?.clickRate || overview?.clickRate || '0.00';
  const bounceRate = campaignMetrics?.bounceRate || overview?.bounceRate || '0.00';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-700 to-purple-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                {campaignId ? 'Campaign Analytics' : 'Email Analytics'}
              </h1>
              <p className="text-sm text-blue-100">
                {campaignId ? `Campaign: ${campaignId}` : 'Overview of all email campaigns'}
              </p>
            </div>
            <div className="flex bg-white/20 backdrop-blur-sm rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    'px-4 py-2 text-sm rounded-md transition-colors font-medium',
                    dateRange === range
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <MetricCard label="Sent" value={metrics.sent || 0} icon={Send} />
          <MetricCard label="Delivered" value={metrics.delivered || 0} icon={Mail} />
          <MetricCard label="Opened" value={metrics.uniqueOpens || metrics.opened || 0} icon={Eye} color="text-green-600" />
          <MetricCard label="Clicked" value={metrics.uniqueClicks || metrics.clicked || 0} icon={MousePointerClick} color="text-blue-600" />
          <MetricCard label="Open Rate" value={openRate} suffix="%" icon={Eye} color="text-green-600" />
          <MetricCard label="Click Rate" value={clickRate} suffix="%" icon={MousePointerClick} color="text-blue-600" />
          <MetricCard label="Bounce Rate" value={bounceRate} suffix="%" icon={AlertTriangle} color="text-red-500" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Trend */}
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Daily Email Activity</h2>
            </div>
            <div className="p-6">
              {daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} name="Sent" />
                    <Line type="monotone" dataKey="opened" stroke="#10b981" strokeWidth={2} dot={false} name="Opened" />
                    <Line type="monotone" dataKey="clicked" stroke="#3b82f6" strokeWidth={2} dot={false} name="Clicked" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <BarChart3 className="h-12 w-12 mb-2" />
                  <p>No data available for this period</p>
                </div>
              )}
            </div>
          </div>

          {/* Engagement Pie */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Engagement Breakdown</h2>
            </div>
            <div className="p-6">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <TrendingUp className="h-12 w-12 mb-2" />
                  <p>No engagement data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Performance Bar Chart */}
        {daily.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
              <Send className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Delivery Performance</h2>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill="#6366f1" radius={[2, 2, 0, 0]} name="Sent" />
                  <Bar dataKey="delivered" fill="#10b981" radius={[2, 2, 0, 0]} name="Delivered" />
                  <Bar dataKey="bounced" fill="#ef4444" radius={[2, 2, 0, 0]} name="Bounced" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
