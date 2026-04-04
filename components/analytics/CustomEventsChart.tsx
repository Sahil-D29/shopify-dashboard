'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Webhook, Loader2, TrendingUp } from 'lucide-react';
import { useTenant } from '@/lib/tenant/tenant-context';
import dynamic from 'next/dynamic';

interface TrendItem {
  date: string;
  count: number;
}

interface TopEvent {
  eventName: string;
  displayName: string;
  count: number;
}

interface CustomEventsAnalytics {
  totalEvents: number;
  topEvents: TopEvent[];
  trend: TrendItem[];
  period: string;
  definitions: Array<{
    eventName: string;
    displayName: string;
    totalCount: number;
    lastSeenAt: string | null;
  }>;
}

const RechartsBarChart = dynamic(
  () => import('recharts').then(mod => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } = mod;
    return {
      default: ({ data }: { data: TrendItem[] }) => (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(val: string) => {
                const d = new Date(val);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(val: string) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Events" />
          </BarChart>
        </ResponsiveContainer>
      ),
    };
  }),
  { ssr: false, loading: () => <div className="h-[250px] flex items-center justify-center text-muted-foreground">Loading chart...</div> }
);

export function CustomEventsChart() {
  const { currentStore } = useTenant();
  const [analytics, setAnalytics] = useState<CustomEventsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const storeId = currentStore?.id;

  const fetchAnalytics = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/analytics/custom-events?period=${period}`, {
        headers: { 'x-store-id': storeId },
      });
      const data = await res.json();
      if (data.success) setAnalytics(data.analytics);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [storeId, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics || (analytics.totalEvents === 0 && analytics.definitions.length === 0)) {
    return null; // Don't show card if no custom events exist
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Webhook className="h-5 w-5 text-purple-600" />
          Custom Events
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex items-center gap-4">
          <div className="rounded-lg border p-3 text-center flex-1">
            <p className="text-2xl font-bold text-purple-600">{analytics.totalEvents.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          <div className="rounded-lg border p-3 text-center flex-1">
            <p className="text-2xl font-bold text-blue-600">{analytics.definitions.length}</p>
            <p className="text-xs text-muted-foreground">Event Types</p>
          </div>
        </div>

        {/* Trend Chart */}
        {analytics.trend.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Daily Volume
            </p>
            <RechartsBarChart data={analytics.trend} />
          </div>
        )}

        {/* Top Events */}
        {analytics.topEvents.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Top Events</p>
            <div className="space-y-2">
              {analytics.topEvents.slice(0, 5).map((event) => (
                <div key={event.eventName} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">{event.eventName}</Badge>
                    <span className="text-muted-foreground">{event.displayName}</span>
                  </div>
                  <span className="font-medium">{event.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
