'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ShopifyOrder, ShopifyOrderListResponse } from '@/lib/types/shopify-order';

const formatCurrency = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  return `₹${Number.isFinite(numeric) ? numeric.toLocaleString('en-IN') : '0'}`;
};

const formatDate = (value?: string | null): string =>
  value ? format(new Date(value), 'MMM dd, yyyy') : '—';

const getStatusColor = (status?: string | null): string => {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    refunded: 'bg-red-100 text-red-800 border-red-200',
    fulfilled: 'bg-blue-100 text-blue-800 border-blue-200',
    unfulfilled: 'bg-gray-100 text-gray-800 border-gray-200',
    partial: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const key = status?.toLowerCase();
  if (!key) {
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  return colors[key] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const extractTags = (tags?: string | null): string[] =>
  (tags ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 4);

function OrdersContent() {
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const fetchOrders = useCallback(
    async (forceRefresh = false) => {
      if (!isMounted) return;

      setIsRefreshing(forceRefresh);
      setIsLoading(prev => (forceRefresh ? prev : true));

      try {
        const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
        const baseUrl = getBaseUrl();
        const refreshParam = forceRefresh ? '&refresh=true' : '';
        const res = await fetchWithConfig(`${baseUrl}/api/shopify/orders?limit=250${refreshParam}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => ({}))) as ShopifyOrderListResponse;

        if (!res.ok) {
          throw new Error(payload.error ?? 'Failed to fetch orders');
        }

        setOrders(payload.orders ?? []);
        setLastSynced(
          typeof payload.lastSynced === 'number' ? payload.lastSynced : Date.now()
        );
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isMounted]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchOrders();
    }
  }, [isMounted, fetchOrders]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    console.log('🔄 Config changed, reloading orders...');
    fetchOrders(true);
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await fetchOrders(true);
  }, { interval: 30000, enabled: true }); // Refresh every 30 seconds

  const handleRefresh = useCallback(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  const ordersSummary = useMemo(
    () => ({
      total: orders.length,
    }),
    [orders.length]
  );

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            View and manage all orders • Live syncing every 30s
            {lastSynced && (
              <span className="ml-2 text-xs text-gray-500">
                • Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{ordersSummary.total} total</Badge>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                Orders will appear here once customers make purchases.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Order Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Discounts</TableHead>
                <TableHead>Line Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Weight (g)</TableHead>
                <TableHead>Financial</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="text-xs text-muted-foreground">{order.id}</TableCell>
                  <TableCell className="font-medium">
                    {order.order_number != null ? `#${order.order_number}` : '—'}
                  </TableCell>
                  <TableCell>{order.name ?? '—'}</TableCell>
                  <TableCell>
                    {order.customer
                      ? `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim() || 'Customer'
                      : 'Guest'}
                  </TableCell>
                  <TableCell>{order.email ?? '—'}</TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                  <TableCell>{formatDate(order.updated_at)}</TableCell>
                  <TableCell>{formatDate(order.processed_at)}</TableCell>
                  <TableCell>{order.currency ?? '—'}</TableCell>
                  <TableCell>{formatCurrency(order.subtotal_price)}</TableCell>
                  <TableCell>{formatCurrency(order.total_tax)}</TableCell>
                  <TableCell>{formatCurrency(order.total_discounts)}</TableCell>
                  <TableCell>{order.line_items?.length ?? 0}</TableCell>
                  <TableCell>{formatCurrency(order.total_price)}</TableCell>
                  <TableCell>{order.total_weight ?? 0}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.financial_status)}>
                      {order.financial_status ?? 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.fulfillment_status ?? 'unfulfilled')}>
                      {order.fulfillment_status ?? 'unfulfilled'}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.gateway ?? order.payment_gateway_names?.[0] ?? '—'}</TableCell>
                  <TableCell>{order.source_name ?? '—'}</TableCell>
                  <TableCell>{order.test ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="max-w-[240px]">
                    {extractTags(order.tags).map(tag => (
                      <Badge key={tag} variant="outline" className="mr-1 mb-1">
                        {tag}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ConfigurationGuard>
      <OrdersContent />
    </ConfigurationGuard>
  );
}
