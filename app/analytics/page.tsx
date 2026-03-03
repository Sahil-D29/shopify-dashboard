'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Package,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  revenueGrowth: number;
  ordersGrowth: number;
  abandonedCarts?: number;
  abandonedCartsValue?: number;
  lastSynced?: number;
  cached?: boolean;
}

interface RevenueTrendItem {
  date: string;
  revenue: number;
}

interface TopProduct {
  product_id: string;
  title: string;
  revenue: number;
  units: number;
}

interface TopCustomer {
  id: number;
  name: string;
  total_spent: number;
  orders_count: number;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '\u20B90';
  return `\u20B9${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatGrowth(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function AnalyticsContent() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const refreshParam = forceRefresh ? 'refresh=true' : '';

      const [summaryRes, trendRes, productsRes, customersRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/shopify/analytics?${refreshParam}`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/shopify/analytics/revenue-trend`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/shopify/analytics/top-products`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/shopify/analytics/top-customers`, { cache: 'no-store' }),
      ]);

      // Parse summary
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        setSummary(data);
        setLastSynced(data.lastSynced ?? Date.now());
      }

      // Parse revenue trend
      if (trendRes.status === 'fulfilled' && trendRes.value.ok) {
        const data = await trendRes.value.json();
        setRevenueTrend(data.trend ?? []);
      }

      // Parse top products
      if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
        const data = await productsRes.value.json();
        setTopProducts(data.top ?? []);
      }

      // Parse top customers
      if (customersRes.status === 'fulfilled' && customersRes.value.ok) {
        const data = await customersRes.value.json();
        setTopCustomers(data.top ?? []);
      }

      setErrorMessage(null);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useConfigRefresh(() => {
    fetchAnalytics(true);
  });

  useAutoRefresh(async () => {
    await fetchAnalytics(true);
  }, { interval: 30000, enabled: true });

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Shopify store performance overview &bull; Live syncing every 30s
            {lastSynced && (
              <span className="ml-2 text-xs text-gray-500">
                &bull; Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
              <p className={`text-xs mt-1 ${summary.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.revenueGrowth >= 0 ? (
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="inline h-3 w-3 mr-1" />
                )}
                {formatGrowth(summary.revenueGrowth)} from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders.toLocaleString()}</div>
              <p className={`text-xs mt-1 ${summary.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.ordersGrowth >= 0 ? (
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="inline h-3 w-3 mr-1" />
                )}
                {formatGrowth(summary.ordersGrowth)} from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCustomers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.averageOrderValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per order average</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abandoned Carts Summary */}
      {summary && (summary.abandonedCarts ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abandoned Carts</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.abandonedCarts}</div>
              <p className="text-xs text-muted-foreground mt-1">Unrecovered checkouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abandoned Cart Value</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.abandonedCartsValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Potential revenue to recover</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue Trend */}
      {revenueTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueTrend.slice().reverse().map((item) => (
                  <TableRow key={item.date}>
                    <TableCell>{format(new Date(item.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Products & Top Customers side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top 5 Products by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No product data available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={product.product_id}>
                      <TableCell>
                        <Badge variant="outline">{index + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={product.title}>
                        {product.title}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                      <TableCell className="text-right">{product.units}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 5 Customers by Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No customer data available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((customer, index) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Badge variant="outline">{index + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(customer.total_spent)}</TableCell>
                      <TableCell className="text-right">{customer.orders_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
