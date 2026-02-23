'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HeartPulse, RefreshCw, Users, Store, CreditCard, AlertTriangle,
  CheckCircle, XCircle, AlertCircle, Clock,
} from 'lucide-react';

interface HealthData {
  overallStatus: string;
  metrics: {
    activeUsers: number;
    totalStores: number;
    activeSubscriptions: number;
    errors24h: number;
    errors7d: number;
    errorCounts: { CRITICAL: number; ERROR: number; WARNING: number; INFO: number };
  };
  queue: { pending: number; processing: number; failed: number };
  services: Record<string, { status: string; message?: string; lastCheck?: string }>;
  recentErrors: Array<{
    id: string;
    level: string;
    message: string;
    context: any;
    resolved: boolean;
    createdAt: string;
  }>;
  serverUptime: number;
}

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchHealth(); }, []);

  async function fetchHealth() {
    try {
      const res = await fetch('/api/admin/system-health', { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function refresh() {
    setRefreshing(true);
    fetchHealth();
  }

  const statusColor = (s: string) => {
    switch (s.toUpperCase()) {
      case 'HEALTHY': case 'RUNNING': return 'bg-green-100 text-green-700';
      case 'DEGRADED': case 'WARNING': case 'PAUSED': return 'bg-yellow-100 text-yellow-700';
      case 'DOWN': case 'ERROR': case 'STOPPED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const statusIcon = (s: string) => {
    switch (s.toUpperCase()) {
      case 'HEALTHY': case 'RUNNING': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'DEGRADED': case 'WARNING': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'DOWN': case 'ERROR': case 'STOPPED': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const fmtUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const levelColor = (l: string) => {
    switch (l) {
      case 'CRITICAL': return 'bg-red-100 text-red-700';
      case 'ERROR': return 'bg-orange-100 text-orange-700';
      case 'WARNING': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading system health...</div>;
  if (!data) return <div className="p-6 text-red-500">Failed to load system health</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-gray-500 text-sm">Monitor system status and performance</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className={data.overallStatus === 'HEALTHY' ? 'border-green-200 bg-green-50' : data.overallStatus === 'DEGRADED' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
        <CardContent className="py-4 flex items-center gap-4">
          <HeartPulse className={`h-8 w-8 ${data.overallStatus === 'HEALTHY' ? 'text-green-500' : data.overallStatus === 'DEGRADED' ? 'text-yellow-500' : 'text-red-500'}`} />
          <div>
            <div className="font-semibold text-lg">System Status: {data.overallStatus}</div>
            <div className="text-sm text-gray-600">Server Uptime: {fmtUptime(data.serverUptime)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" /> Active Users (24h)</div>
            <div className="text-2xl font-bold mt-1">{data.metrics.activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Store className="h-4 w-4" /> Active Stores</div>
            <div className="text-2xl font-bold mt-1">{data.metrics.totalStores}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><CreditCard className="h-4 w-4" /> Active Subscriptions</div>
            <div className="text-2xl font-bold mt-1">{data.metrics.activeSubscriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><AlertTriangle className="h-4 w-4" /> Errors (24h)</div>
            <div className="text-2xl font-bold mt-1">{data.metrics.errors24h}</div>
            <div className="text-xs text-gray-400">7d total: {data.metrics.errors7d}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.services).map(([name, svc]) => (
              <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  {statusIcon(svc.status)}
                  <div>
                    <div className="font-medium text-sm capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</div>
                    {svc.message && <div className="text-xs text-gray-400">{svc.message}</div>}
                  </div>
                </div>
                <Badge className={statusColor(svc.status)}>{svc.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">{data.queue.pending}</div>
                <div className="text-xs text-gray-500 mt-1">Pending</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">{data.queue.processing}</div>
                <div className="text-xs text-gray-500 mt-1">Processing</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50">
                <div className="text-2xl font-bold text-red-600">{data.queue.failed}</div>
                <div className="text-xs text-gray-500 mt-1">Failed</div>
              </div>
            </div>

            {/* Error Severity Breakdown */}
            <div className="mt-6">
              <div className="text-sm font-medium mb-2">Error Breakdown (24h)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {Object.entries(data.metrics.errorCounts).map(([level, count]) => (
                  <div key={level} className="p-2 rounded bg-gray-50">
                    <div className="text-lg font-bold">{count}</div>
                    <Badge className={`${levelColor(level)} text-[10px]`}>{level}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Errors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentErrors.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No recent errors</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Severity</th>
                    <th className="text-left p-3 font-medium">Message</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentErrors.map(err => (
                    <tr key={err.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {new Date(err.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge className={levelColor(err.level)}>{err.level}</Badge>
                      </td>
                      <td className="p-3 max-w-md truncate">{err.message}</td>
                      <td className="p-3">
                        {err.resolved
                          ? <Badge className="bg-green-100 text-green-700">Resolved</Badge>
                          : <Badge className="bg-gray-100 text-gray-500">Open</Badge>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
