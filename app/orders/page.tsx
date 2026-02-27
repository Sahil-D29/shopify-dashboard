'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ShoppingCart, RefreshCw, MessageSquare, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ShopifyOrder, ShopifyOrderListResponse } from '@/lib/types/shopify-order';

interface AttributedOrder {
  convertedOrderId: string;
  convertedAmount: number | null;
  convertedAt: string | null;
  campaignId: string;
  campaignName: string;
}

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
  const [sourceFilter, setSourceFilter] = useState<'all' | 'campaigns'>('all');
  const [attributedOrders, setAttributedOrders] = useState<AttributedOrder[]>([]);
  const [attributedLoaded, setAttributedLoaded] = useState(false);

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

  const fetchAttributedOrders = useCallback(async () => {
    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/api/orders/campaign-attributed`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({ attributedOrders: [] }));
      setAttributedOrders(data.attributedOrders ?? []);
      setAttributedLoaded(true);
    } catch {
      setAttributedOrders([]);
      setAttributedLoaded(true);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchOrders();
      fetchAttributedOrders();
    }
  }, [isMounted, fetchOrders, fetchAttributedOrders]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    fetchOrders(true);
    fetchAttributedOrders();
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await fetchOrders(true);
    await fetchAttributedOrders();
  }, { interval: 30000, enabled: true });

  const handleRefresh = useCallback(() => {
    fetchOrders(true);
    fetchAttributedOrders();
  }, [fetchOrders, fetchAttributedOrders]);

  // Build a map of Shopify order number/name -> campaign info
  const attributionMap = useMemo(() => {
    const map = new Map<string, AttributedOrder>();
    for (const ao of attributedOrders) {
      if (ao.convertedOrderId) {
        map.set(ao.convertedOrderId, ao);
      }
    }
    return map;
  }, [attributedOrders]);

  // Filter orders based on source
  const filteredOrders = useMemo(() => {
    if (sourceFilter === 'all') return orders;
    // Show only orders that have a campaign attribution
    return orders.filter(order => {
      const orderId = String(order.id);
      const orderName = order.name ?? '';
      const orderNumber = order.order_number != null ? String(order.order_number) : '';
      return attributionMap.has(orderId) || attributionMap.has(orderName) || attributionMap.has(orderNumber);
    });
  }, [orders, sourceFilter, attributionMap]);

  const getCampaignName = (order: ShopifyOrder): string | null => {
    const orderId = String(order.id);
    const orderName = order.name ?? '';
    const orderNumber = order.order_number != null ? String(order.order_number) : '';
    const match = attributionMap.get(orderId) || attributionMap.get(orderName) || attributionMap.get(orderNumber);
    return match?.campaignName ?? null;
  };

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
            View and manage orders • Live syncing every 30s
            {lastSynced && (
              <span className="ml-2 text-xs text-gray-500">
                • Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{filteredOrders.length} orders</Badge>
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

      {/* Source Filter Toggle */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500 mr-2">Source:</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setSourceFilter('all')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              sourceFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingCart className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setSourceFilter('campaigns')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              sourceFilter === 'campaigns'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            From Campaigns ({attributedLoaded ? attributedOrders.length : '...'})
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {sourceFilter === 'campaigns' ? 'Campaign-Attributed Orders' : 'Order List'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {sourceFilter === 'campaigns' ? 'No campaign-attributed orders' : 'No orders found'}
              </h3>
              <p className="text-muted-foreground">
                {sourceFilter === 'campaigns'
                  ? 'Orders converted from WhatsApp campaigns will appear here.'
                  : 'Orders will appear here once customers make purchases.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Financial</TableHead>
                    <TableHead className="hidden md:table-cell">Fulfillment</TableHead>
                    <TableHead className="hidden md:table-cell">Source</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="hidden lg:table-cell">Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => {
                    const campaignName = getCampaignName(order);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.order_number != null ? `#${order.order_number}` : '—'}
                        </TableCell>
                        <TableCell>
                          {order.customer
                            ? `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim() || 'Customer'
                            : 'Guest'}
                        </TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(order.total_price)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.financial_status)}>
                            {order.financial_status ?? 'pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={getStatusColor(order.fulfillment_status ?? 'unfulfilled')}>
                            {order.fulfillment_status ?? 'unfulfilled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-600">
                          {order.source_name ?? '—'}
                        </TableCell>
                        <TableCell>
                          {campaignName ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              {campaignName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px]">
                          {extractTags(order.tags).map(tag => (
                            <Badge key={tag} variant="outline" className="mr-1 mb-1 text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
