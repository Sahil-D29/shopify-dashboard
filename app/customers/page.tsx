'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CustomerManagement } from '@/components/customers/CustomerManagement';
import type { Customer as CustomerManagementCustomer } from '@/components/customers/CustomerManagement';
import { Users, RefreshCw } from 'lucide-react';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

function formatCurrency(value: number | string | null | undefined) {
  const numeric =
    typeof value === 'string'
      ? Number.parseFloat(value)
      : typeof value === 'number'
      ? value
      : 0;
  if (!Number.isFinite(numeric)) return '₹0.00';
  return `₹${numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface ApiCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  orders_count?: number;
  total_spent?: string;
  state?: string;
  verified_email?: boolean;
  accepts_marketing?: boolean;
  marketing_opt_in_level?: string | null;
  tax_exempt?: boolean;
  tags?: string | string[];
  note?: string | null;
  addresses?: Array<{
    address1?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  }>;
  created_at?: string | null;
  updated_at?: string | null;
  last_order_id?: number | null;
  last_order_name?: string | null;
  last_order_date?: string | null;
  aov?: number;
}

export default function CustomersClientPage() {
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const customersForManagement: CustomerManagementCustomer[] = customers.map((customer) => ({
    id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone ?? undefined,
    orders_count: customer.orders_count,
    total_spent: customer.total_spent,
    state: customer.state,
    addresses: customer.addresses,
    tags: Array.isArray(customer.tags) ? customer.tags.join(', ') : customer.tags,
    note: customer.note ?? undefined,
  }));

  const fetchCustomers = useCallback(async (forceRefresh = false) => {
    if (!isMounted) return;
    
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
      const baseUrl = getBaseUrl();
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const url = `${baseUrl}/api/customers?limit=250${refreshParam}`;
      
      console.log('🔄 Fetching customers from:', url);
      
      const res = await fetchWithConfig(url, {
        cache: 'no-store',
        credentials: 'include',
      });
      
      console.log('📡 Response status:', res.status, res.statusText);
      console.log('📡 Response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        // Try to get error details from response
        let errorText = '';
        let errorData = null;
        
        try {
          errorText = await res.text();
          console.error('❌ API Error Response:', {
            status: res.status,
            statusText: res.statusText,
            body: errorText,
          });
          
          // Try to parse as JSON
          try {
            errorData = JSON.parse(errorText);
            console.error('❌ Parsed error data:', errorData);
          } catch {
            // Not JSON, use text as is
          }
        } catch (textError) {
          console.error('❌ Failed to read error response:', textError);
        }
        
        const errorMessage = errorData?.error || errorData?.message || errorData?.details || errorText || `Failed to fetch customers: ${res.status} ${res.statusText}`;
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      console.log('✅ Customers data received:', {
        customerCount: data.customers?.length || 0,
        lastSynced: data.lastSynced,
        cached: data.cached,
      });
      
      if (data.error) {
        console.error('❌ Error in response data:', data.error, data.details);
        throw new Error(data.error || data.message || data.details || 'Failed to fetch customers');
      }
      
      setCustomers(data.customers || []);
      setLastSynced(data.lastSynced || Date.now());
      setErrorMessage(''); // Clear any previous errors
    } catch (error) {
      console.error('❌ Error fetching customers:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch customers';
      setErrorMessage(errorMsg);
      setCustomers([]); // Clear customers on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isMounted]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchCustomers();
    }
  }, [isMounted, fetchCustomers]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    console.log('🔄 Config changed, reloading customers...');
    fetchCustomers(true);
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await fetchCustomers(true);
  }, { interval: 30000, enabled: true }); // Refresh every 30 seconds

  const handleRefresh = () => {
    fetchCustomers(true);
  };

  return (
    <ConfigurationGuard>
      <div className="space-y-4">
        <CustomerManagement customers={customersForManagement} onRefresh={handleRefresh} />

        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Live syncing every 30s
            {lastSynced && (
              <> • Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}</>
            )}
          </span>
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

        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
            <div className="text-center py-8">Loading customers...</div>
            ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first customer.
              </p>
            </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>AOV</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Opt-in Level</TableHead>
                  <TableHead>Tax Exempt</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="text-xs text-muted-foreground">{customer.id}</TableCell>
                    <TableCell className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone || 'N/A'}</TableCell>
                    <TableCell>{customer.orders_count ?? 0}</TableCell>
                    <TableCell>{formatCurrency(customer.total_spent)}</TableCell>
                    <TableCell>
                      {(customer.aov ?? 0) > 0
                        ? formatCurrency(customer.aov ?? 0)
                        : (customer.orders_count ?? 0) > 0
                        ? formatCurrency(Number(customer.total_spent) / (customer.orders_count ?? 1))
                        : '₹0'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.state === 'enabled' ? 'default' : 'secondary'}>
                        {customer.state || 'enabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(customer.verified_email ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')}>
                        {customer.verified_email ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(customer.accepts_marketing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')}>
                        {customer.accepts_marketing ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.accepts_marketing 
                        ? (customer.marketing_opt_in_level || 'Subscribed')
                        : 'Unsubscribed'}
                    </TableCell>
                    <TableCell>{customer.tax_exempt ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="max-w-[240px]">
                      {(Array.isArray(customer.tags) ? customer.tags.join(',') : (customer.tags ?? ''))
                        .split(',')
                        .map((tag: string) => tag.trim())
                        .filter(Boolean)
                        .slice(0, 4)
                        .map((tag: string) => (
                        <Badge key={tag} variant="outline" className="mr-1 mb-1">
                          {tag}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate" title={customer.note ?? ''}>{customer.note ?? '—'}</TableCell>
                    <TableCell>
                      {customer.created_at 
                        ? format(new Date(customer.created_at), 'MMM dd, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {customer.updated_at 
                        ? format(new Date(customer.updated_at), 'MMM dd, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {customer.last_order_date 
                        ? format(new Date(customer.last_order_date), 'MMM dd, yyyy')
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ConfigurationGuard>
  );
}

