'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { DeleteSegmentModal } from '@/components/segments/DeleteSegmentModal';
import { useToast } from '@/lib/hooks/useToast';
import { ArrowLeft, Users, TrendingUp, Package, DollarSign, RefreshCw, AlertTriangle, Trash2, BarChart3 } from 'lucide-react';
import CustomerList from '@/components/segments/CustomerList';
import { SegmentAnalytics } from '@/components/segments/SegmentAnalytics';
import type { CustomerSegment } from '@/lib/types/segment';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsResponse {
  totalCustomers: number;
  growthRate: number;
  revenueTrend: { labels: string[]; data: number[] };
  customerGrowth: { labels: string[]; data: number[] };
  topProducts: { labels: string[]; data: number[] };
  orderDistribution: number[];
}

interface SegmentStatsResponse {
  segment?: SegmentDetail | null;
  error?: string;
}

interface SegmentDetail extends Omit<CustomerSegment, 'averageOrderValue' | 'totalRevenue'> {
  totalValue?: number;
  totalRevenue?: number;
  averageOrderValue?: number;
  lastUpdated?: number;
  usingCachedStats?: boolean;
  usage?: number;
  isSystem?: boolean;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount || 0));

const timeAgo = (timestamp?: number) => {
  if (!timestamp) return 'unknown';
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function SegmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const segmentId = params?.id ?? '';

  const toast = useToast();
  const [segmentDetail, setSegmentDetail] = useState<SegmentDetail | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadStats = async (refresh = false) => {
      setStatsError(null);
      setIsStatsLoading(true);
      try {
        const query = refresh ? '?refresh=true' : '';
        const res = await fetchWithConfig(`/api/segments/${segmentId}${query}`);
        const data = (await res.json().catch(() => ({}))) as SegmentStatsResponse;

        if (!res.ok) throw new Error(data.error ?? 'Failed to load segment');
        if (!isCancelled) setSegmentDetail(data.segment ?? null);
      } catch (error) {
        if (!isCancelled) {
          setStatsError(getErrorMessage(error, 'Unable to load live segment stats'));
          setSegmentDetail(null);
        }
      } finally {
        if (!isCancelled) setIsStatsLoading(false);
      }
    };

    const loadAnalytics = async () => {
      try {
        const res = await fetchWithConfig(`/api/segments/${segmentId}/analytics`);
        if (!res.ok) throw new Error('Failed to load analytics');
        const data: AnalyticsResponse = await res.json();
        if (!isCancelled) setAnalytics(data);
      } catch {
        if (!isCancelled) setAnalytics(null);
      } finally {
        if (!isCancelled) setAnalyticsLoading(false);
      }
    };

    if (segmentId) {
      loadStats();
      loadAnalytics();
    }

    return () => {
      isCancelled = true;
    };
  }, [segmentId]);

  const handleRefreshStats = async () => {
    if (!segmentId) return;
    const res = await fetchWithConfig(`/api/segments/${segmentId}?refresh=true`);
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as SegmentStatsResponse;
      setSegmentDetail(data.segment ?? null);
    }
  };

  const confirmDelete = async () => {
    const res = await fetch(`/api/segments/${segmentId}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message =
        typeof errorBody?.error === 'string' ? errorBody.error : 'Failed to delete segment';
      toast.error(message);
      return;
    }
    toast.success('Segment deleted successfully');
    setIsDeleteModalOpen(false);
    router.push('/segments');
  };

  const segmentName = useMemo(() => segmentDetail?.name || 'Segment', [segmentDetail]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                router.push('/segments');
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {!segmentDetail?.isSystem && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={(e) => {
                  e.preventDefault();
                  setIsDeleteModalOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Segment
              </Button>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{segmentName}</h1>
            <p className="text-muted-foreground">Segment analytics and performance</p>
          </div>
        </div>
        <Badge variant="outline">ID: {segmentId}</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-sm text-muted-foreground">Live segment metrics</CardTitle>
            <CardDescription>
              Last updated: {timeAgo(segmentDetail?.lastUpdated)}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefreshStats}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh stats
          </Button>
        </CardHeader>
        <CardContent>
          {statsError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {statsError}
            </div>
          )}
          {isStatsLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-none bg-gray-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-bold">
                    {(segmentDetail?.customerCount || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-gray-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-bold">
                    {formatINR(segmentDetail?.totalValue || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-gray-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Avg Order Value</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-bold">
                    {formatINR(segmentDetail?.averageOrderValue || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {analyticsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading analytics…</div>
          ) : analytics ? (
            <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{analytics.totalCustomers.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Growth Rate</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{analytics.growthRate}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Top Product</CardTitle>
                <CardDescription>By orders within the segment</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{analytics.topProducts.labels[0] || '—'}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.revenueTrend.labels.map((label, i) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">₹{Math.round(analytics.revenueTrend.data[i]).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Growth</CardTitle>
                <CardDescription>New customers added</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.customerGrowth.labels.map((label, i) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{analytics.customerGrowth.data[i].toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Most popular among this segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topProducts.labels.map((label, i) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{analytics.topProducts.data[i]?.toLocaleString('en-IN') || 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No analytics available for this segment yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <SegmentAnalytics segmentId={segmentId} />
        </TabsContent>

        <TabsContent value="customers">
          <CustomerList segmentId={segmentId} segmentName={segmentName} />
        </TabsContent>
      </Tabs>

      <DeleteSegmentModal
        isOpen={isDeleteModalOpen && !!segmentDetail}
        segmentName={segmentName}
        customerCount={segmentDetail?.customerCount}
        usage={typeof segmentDetail?.usage === 'object' && segmentDetail?.usage != null ? segmentDetail.usage : undefined}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}


