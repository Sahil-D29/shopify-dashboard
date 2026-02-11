'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ShopifyCheckout } from '@/lib/types/shopify-checkout';

type AbandonedCheckout = ShopifyCheckout & {
  token?: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  subtotal_price?: string | number | null;
  total_tax?: string | number | null;
  total_discounts?: string | number | null;
  total_price?: string | number | null;
  currency?: string | null;
  line_items?: Array<{ id?: number | string }>;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

function AbandonedCartsContent() {
  const [carts, setCarts] = useState<AbandonedCheckout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = useCallback((value: string | number | null | undefined): string => {
    if (value == null) return '₹0';
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric)) return '₹0';
    return `₹${numeric.toLocaleString('en-IN')}`;
  }, []);

  const fetchCarts = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetchWithConfig(`${baseUrl}/api/shopify/checkouts?limit=250${refreshParam}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch abandoned carts');
      }
      const data = (await response.json()) as {
        checkouts?: AbandonedCheckout[];
        lastSynced?: number;
      };
      setCarts(data.checkouts ?? []);
      setLastSynced(data.lastSynced ?? Date.now());
      setErrorMessage(null);
    } catch (error) {
      console.error('Error fetching abandoned carts:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch abandoned carts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!isCancelled) {
        await fetchCarts();
      }
    };
    load();
    return () => {
      isCancelled = true;
    };
  }, [fetchCarts]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    console.log('🔄 Config changed, reloading abandoned carts...');
    fetchCarts(true);
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await fetchCarts(true);
  }, { interval: 30000, enabled: true }); // Refresh every 30 seconds

  const handleRefresh = () => {
    fetchCarts(true);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading abandoned carts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Abandoned Carts</h1>
          <p className="text-muted-foreground">
            Recover lost sales with WhatsApp reminders • Live syncing every 30s
            {lastSynced && (
              <span className="ml-2 text-xs text-gray-500">
                • Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{carts.length} total</Badge>
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

      {errorMessage && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Abandoned Checkouts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Discounts</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Abandoned</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12">
                    <div className="flex flex-col items-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No abandoned carts found</h3>
                      <p className="text-muted-foreground">
                        Abandoned checkouts will appear here once customers leave without completing their purchase.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                carts.map(cart => (
                  <TableRow key={cart.id}>
                    <TableCell className="text-xs text-muted-foreground">{cart.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]" title={cart.token}>{cart.token}</TableCell>
                    <TableCell className="font-medium">
                      {cart.customer 
                        ? `${cart.customer.first_name} ${cart.customer.last_name}`
                        : 'Guest'}
                    </TableCell>
                    <TableCell>{cart.email || 'N/A'}</TableCell>
                    <TableCell>{cart.phone || 'N/A'}</TableCell>
                    <TableCell>{cart.line_items?.length || 0} items</TableCell>
                    <TableCell>{formatCurrency(cart.subtotal_price)}</TableCell>
                    <TableCell>{formatCurrency(cart.total_tax)}</TableCell>
                    <TableCell>{formatCurrency(cart.total_discounts)}</TableCell>
                    <TableCell>{formatCurrency(cart.total_price)}</TableCell>
                    <TableCell>{cart.currency}</TableCell>
                    <TableCell>
                      {cart.created_at
                        ? formatDistanceToNow(new Date(cart.created_at), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send WhatsApp
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AbandonedCartsPage() {
  return (
    <ConfigurationGuard>
      <AbandonedCartsContent />
    </ConfigurationGuard>
  );
}
