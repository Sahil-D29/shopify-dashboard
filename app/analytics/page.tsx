'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send,
  CheckCheck,
  Eye,
  MousePointerClick,
  Target,
  Users,
  MessageCircle,
  GitBranch,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowRight,
  Megaphone,
} from 'lucide-react';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import dynamic from 'next/dynamic';

// Lazy-load Recharts to avoid SSR issues
const RechartsLineChart = dynamic(
  () => import('recharts').then(mod => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = mod;
    return {
      default: ({ data }: { data: MessageTrendItem[] }) => (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(val: string) => {
                const d = new Date(val);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(val: string) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
            <Legend />
            <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} name="Sent" dot={false} />
            <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Delivered" dot={false} />
            <Line type="monotone" dataKey="read" stroke="#a855f7" strokeWidth={2} name="Read" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    };
  }),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div> }
);

// --- Interfaces ---

interface CampaignOverview {
  total: number;
  active: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalConverted: number;
  totalFailed: number;
  totalRevenue: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  conversionRate: number;
}

interface ContactOverview {
  total: number;
  optedIn: number;
  optedOut: number;
  bySource: Record<string, number>;
}

interface ConversationOverview {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
}

interface JourneyOverview {
  total: number;
  active: number;
  totalEnrollments: number;
  completedEnrollments: number;
}

interface MessageOverview {
  total: number;
  inbound: number;
  outbound: number;
  totalCost: number;
}

interface WhatsAppOverview {
  campaigns: CampaignOverview;
  contacts: ContactOverview;
  conversations: ConversationOverview;
  journeys: JourneyOverview;
  messages: MessageOverview;
}

interface MessageTrendItem {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

interface TopCampaignItem {
  id: string;
  name: string;
  status: string;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalConverted: number;
  totalRevenue: number;
  readRate: number;
  conversionRate: number;
  createdAt: string;
}

// --- Helpers ---

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-IN');
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '\u20B90';
  return `\u20B9${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getRateColor(rate: number, thresholds: [number, number] = [90, 70]): string {
  if (rate >= thresholds[0]) return 'text-green-600';
  if (rate >= thresholds[1]) return 'text-yellow-600';
  return 'text-red-600';
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    RUNNING: { label: 'Running', variant: 'default' },
    COMPLETED: { label: 'Completed', variant: 'secondary' },
    SCHEDULED: { label: 'Scheduled', variant: 'outline' },
    PAUSED: { label: 'Paused', variant: 'outline' },
    FAILED: { label: 'Failed', variant: 'destructive' },
    DRAFT: { label: 'Draft', variant: 'outline' },
    QUEUED: { label: 'Queued', variant: 'outline' },
    CANCELLED: { label: 'Cancelled', variant: 'outline' },
  };
  const config = map[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const SOURCE_LABELS: Record<string, string> = {
  SHOPIFY: 'Shopify',
  CSV_IMPORT: 'CSV Import',
  MANUAL: 'Manual',
  WHATSAPP_INBOUND: 'WhatsApp Inbound',
  FORM: 'Form',
};

const SOURCE_COLORS: Record<string, string> = {
  SHOPIFY: 'bg-green-500',
  CSV_IMPORT: 'bg-blue-500',
  MANUAL: 'bg-purple-500',
  WHATSAPP_INBOUND: 'bg-emerald-500',
  FORM: 'bg-orange-500',
};

// --- Main Content ---

function AnalyticsContent() {
  const [overview, setOverview] = useState<WhatsAppOverview | null>(null);
  const [messageTrend, setMessageTrend] = useState<MessageTrendItem[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setIsSyncing(true);

    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();

      const [overviewRes, trendsRes, campaignsRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/analytics/whatsapp/overview`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/analytics/whatsapp/trends`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/analytics/whatsapp/top-campaigns`, { cache: 'no-store' }),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        setOverview(await overviewRes.value.json());
      }

      if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
        const data = await trendsRes.value.json();
        setMessageTrend(data.messageTrend ?? []);
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const data = await campaignsRes.value.json();
        setTopCampaigns(data.topCampaigns ?? []);
      }

      setLastSynced(new Date());
    } catch (error) {
      console.error('Error fetching WhatsApp analytics:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useConfigRefresh(() => {
    fetchAnalytics(true);
  });

  useAutoRefresh(async () => {
    await fetchAnalytics();
  }, { interval: 15000, enabled: true });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading WhatsApp analytics...</p>
        </div>
      </div>
    );
  }

  const c = overview?.campaigns;
  const contacts = overview?.contacts;
  const conv = overview?.conversations;
  const journeys = overview?.journeys;

  // Funnel data
  const funnelSteps = [
    { label: 'Sent', value: c?.totalSent ?? 0, color: 'bg-blue-500' },
    { label: 'Delivered', value: c?.totalDelivered ?? 0, color: 'bg-cyan-500' },
    { label: 'Read', value: c?.totalRead ?? 0, color: 'bg-purple-500' },
    { label: 'Clicked', value: c?.totalClicked ?? 0, color: 'bg-amber-500' },
    { label: 'Converted', value: c?.totalConverted ?? 0, color: 'bg-green-500' },
  ];
  const maxFunnel = funnelSteps[0].value || 1;

  // Contact source data
  const sourceEntries = Object.entries(contacts?.bySource ?? {}).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = sourceEntries[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            WhatsApp Marketing Analytics
            <span className="flex items-center gap-1.5 text-sm font-normal text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time campaign performance & engagement metrics
            {lastSynced && (
              <span className="ml-2 text-xs">
                &bull; Last synced: {lastSynced.toLocaleTimeString('en-IN')}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => fetchAnalytics(true)}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* KPI Row 1 — Campaign Performance */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(c?.totalSent ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(c?.totalFailed ?? 0)} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCheck className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(c?.deliveryRate ?? 0)}`}>
              {(c?.deliveryRate ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(c?.totalDelivered ?? 0)} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
            <Eye className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(c?.readRate ?? 0, [80, 50])}`}>
              {(c?.readRate ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(c?.totalRead ?? 0)} read
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaign Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(c?.totalRevenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(c?.totalConverted ?? 0)} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Row 2 — Platform Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c?.active ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {c?.total ?? 0} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(contacts?.optedIn ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(contacts?.total ?? 0)} total &bull; {contacts?.optedOut ?? 0} opted out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Conversations</CardTitle>
            <MessageCircle className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conv?.open ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {conv?.pending ?? 0} pending &bull; {conv?.total ?? 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Journeys</CardTitle>
            <GitBranch className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{journeys?.active ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(journeys?.totalEnrollments ?? 0)} enrollments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Message Delivery Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Message Delivery Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(c?.totalSent ?? 0) === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No campaign messages sent yet. Start a campaign to see funnel data.</p>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const pct = maxFunnel > 0 ? (step.value / maxFunnel) * 100 : 0;
                const prevValue = i > 0 ? funnelSteps[i - 1].value : step.value;
                const dropPct = prevValue > 0 ? ((step.value / prevValue) * 100).toFixed(1) : '0';
                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-20">{step.label}</span>
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {dropPct}% of {funnelSteps[i - 1].label.toLowerCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold">{formatNumber(step.value)}</span>
                    </div>
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Message Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messageTrend.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No message data for the last 30 days.</p>
          ) : (
            <RechartsLineChart data={messageTrend} />
          )}
        </CardContent>
      </Card>

      {/* Top Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Top Campaigns by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No campaigns with data yet. Create and run a campaign to see results.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Read Rate</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCampaigns.map((campaign, i) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Badge variant="outline">{i + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={campaign.name}>
                        {campaign.name}
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell className="text-right">{formatNumber(campaign.totalSent)}</TableCell>
                      <TableCell className={`text-right font-medium ${getRateColor(campaign.readRate, [80, 50])}`}>
                        {campaign.readRate}%
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(campaign.totalClicked)}</TableCell>
                      <TableCell className="text-right">{formatNumber(campaign.totalConverted)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(campaign.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row: Contact Sources + Conversation Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contact Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceEntries.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No contacts yet.</p>
            ) : (
              <div className="space-y-3">
                {sourceEntries.map(([source, count]) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{SOURCE_LABELS[source] ?? source}</span>
                      <span className="text-sm text-muted-foreground">{formatNumber(count)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${SOURCE_COLORS[source] ?? 'bg-gray-400'} rounded-full transition-all duration-500`}
                        style={{ width: `${(count / maxSourceCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversation Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-teal-600">{conv?.open ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Open</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-yellow-600">{conv?.pending ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Pending</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{conv?.resolved ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Resolved</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-gray-600">{conv?.closed ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Closed</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">
                Total conversations: <span className="font-semibold text-foreground">{formatNumber(conv?.total ?? 0)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ConfigurationGuard>
      <AnalyticsContent />
    </ConfigurationGuard>
  );
}
