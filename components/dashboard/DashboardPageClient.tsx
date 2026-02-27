'use client';

import Image from 'next/image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { StoreConfigManager } from '@/lib/store-config';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  Package,
  MapPin,
  AlertCircle,
  RefreshCw,
  Store,
  Zap,
  ArrowRight,
  ShoppingBag,
  Settings,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { getWindowStorage } from '@/lib/window-storage';
import type { ShopifyOrder, ShopifyOrderListResponse } from '@/lib/types/shopify-order';
import type { ShopifyProduct, ShopifyProductListResponse } from '@/lib/types/shopify-product';
import type { ShopifyCustomer, ShopifyCustomerListResponse } from '@/lib/types/shopify-customer';
import type { ShopifyLocation, ShopifyLocationListResponse } from '@/lib/types/shopify-location';
import type { ShopifyCheckout, ShopifyCheckoutListResponse } from '@/lib/types/shopify-checkout';

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

interface ShopifyAnalyticsSummary extends ApiErrorPayload {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  revenueGrowth: number;
  ordersGrowth: number;
  abandonedCarts?: number;
  abandonedCartsValue?: number;
  recentOrders?: number;
  previousOrders?: number;
  lastSynced?: number;
  cached?: boolean;
}

interface CampaignAnalytics {
  totalCampaigns: number;
  totalMessagesSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  campaignRevenue: number;
  deliveryRate: number;
  readRate: number;
  conversionRate: number;
}

interface DashboardData {
  analytics: ShopifyAnalyticsSummary;
  orders: ShopifyOrder[];
  products: ShopifyProduct[];
  customers: ShopifyCustomer[];
  locations: ShopifyLocation[];
  checkouts: ShopifyCheckout[];
  campaignAnalytics: CampaignAnalytics;
  lastSynced?: number;
}

const gradientMap = {
  warm: 'from-amber-700 to-amber-800',
  sand: 'from-stone-500 to-stone-600',
  clay: 'from-orange-700 to-orange-800',
  taupe: 'from-stone-600 to-stone-700',
};

const accentBorderMap = {
  warm: 'from-amber-600 to-amber-800',
  sand: 'from-stone-400 to-stone-600',
  clay: 'from-orange-600 to-orange-800',
  taupe: 'from-stone-500 to-stone-700',
} as const;

const SHOPIFY_STORE_DATA_KEY = 'shopify:store_data';
const SHOPIFY_ORDERS_KEY = 'shopify:orders';
const SHOPIFY_PRODUCTS_KEY = 'shopify:products';
const SHOPIFY_CUSTOMERS_KEY = 'shopify:customers';
const SHOPIFY_LOCATIONS_KEY = 'shopify:locations';
const SHOPIFY_CHECKOUTS_KEY = 'shopify:checkouts';
const SHOPIFY_LAST_SYNCED_KEY = 'shopify:last_synced';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

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

function parseJsonResponse<T extends ApiErrorPayload>(
  response: Response,
  context: string
): Promise<T> {
  return response
    .json()
    .catch(() => ({}))
    .then(payload => {
      const data = payload as T;
      if (!response.ok) {
        throw new Error(data.error ?? data.message ?? `Failed to load ${context}`);
      }
      return data;
    });
}

const formatDateLabel = (value?: string | null): string =>
  value ? format(new Date(value), 'MMM dd, yyyy') : '—';

const formatPersonName = (first?: string | null, last?: string | null, fallback = 'Guest'): string => {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || fallback;
};

const formatCustomerInitials = (customer: ShopifyCustomer): string => {
  const initials = `${customer.first_name?.[0] ?? ''}${customer.last_name?.[0] ?? ''}`.trim();
  if (initials) return initials.toUpperCase();
  const letter = customer.email?.[0] ?? customer.phone?.[0] ?? 'C';
  return letter.toUpperCase();
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: number;
  accent: keyof typeof gradientMap;
}

const MetricCard = memo(function MetricCard({ title, value, subtitle, icon: Icon, trend, accent }: MetricCardProps) {
  const gradient = gradientMap[accent];
  const accentGradient = accentBorderMap[accent];
  const isPositive = typeof trend === 'number' && trend > 0;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className={`h-1 w-full bg-gradient-to-r ${accentGradient}`} />
      <div className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg bg-gradient-to-br ${gradient} bg-opacity-10 p-3`}>
            <Icon className="h-6 w-6 text-gray-700" />
          </div>
          {typeof trend === 'number' && trend !== 0 && (
            <div
              className={`flex items-center gap-1 text-sm font-semibold ${
                isPositive ? 'text-green-600' : 'text-rose-500'
              }`}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-600 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
    </div>
  );
});

interface DashboardHeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
  lastSynced?: number;
}

function DashboardHeader({ refreshing, onRefresh, lastSynced }: DashboardHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-700 via-stone-800 to-stone-900 shadow-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative flex flex-col gap-6 px-8 py-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 text-white">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Live overview of your store • Auto-syncing every 30s
            </span>
            {lastSynced ? (
              <span className="rounded bg-white/20 px-2 py-1 text-xs text-white backdrop-blur-sm">
                Last synced: {format(new Date(lastSynced), 'PPP HH:mm:ss')}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-stone-700 shadow-lg transition-colors hover:bg-stone-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>
    </div>
  );
}

interface ConnectionStatusProps {
  shopUrl?: string;
}

function ConnectionStatus({ shopUrl }: ConnectionStatusProps) {
  if (!shopUrl) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-6 py-4 text-sm text-gray-700 shadow-sm">
      <div className="flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <Zap className="h-5 w-5 text-stone-600" />
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="font-semibold text-gray-900">Connected to:</span>
          <span className="font-mono text-sm text-gray-700">{shopUrl}</span>
        </div>
        <p className="text-xs text-gray-600">All systems operational</p>
      </div>
      <Button variant="ghost" className="text-stone-600 hover:text-stone-700">
        Manage
      </Button>
    </div>
  );
}

interface SettingsIncompleteBannerProps {
  missingConfigs: string[];
}

function SettingsIncompleteBanner({ missingConfigs }: SettingsIncompleteBannerProps) {
  const router = useRouter();
  
  if (missingConfigs.length === 0) return null;
  
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Complete Your Store Setup</h3>
            <p className="mt-1 text-sm text-amber-800">
              Welcome! Please configure your store settings to get started. You need to set up:
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingConfigs.map((config) => (
              <div
                key={config}
                className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm font-medium text-amber-900"
              >
                <XCircle className="h-4 w-4 text-amber-600" />
                {config}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push('/settings?setup=true')}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              <Settings className="mr-2 h-4 w-4" />
              Complete Setup
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/settings?setup=true')}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Go to Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RecentOrdersTableProps {
  orders: ShopifyOrder[];
}

function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          {orders.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">{orders.length} New</span>
          ) : null}
        </div>
        <Button variant="ghost" className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-700">
          View All Orders
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-gray-500">
            <ShoppingCart className="h-10 w-10 text-gray-300" />
            <p>No orders found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Order #
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Customer
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Total
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </TableHead>
                <TableHead className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {orders.map(order => (
                <TableRow key={order.id} className="transition-colors hover:bg-gray-50">
                  <TableCell className="px-6 py-4 font-mono text-sm font-medium text-gray-900">
                    {order.order_number != null ? `#${order.order_number}` : '—'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-gray-700">
                    {order.customer
                      ? formatPersonName(order.customer.first_name, order.customer.last_name)
                      : 'Guest'}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(order.total_price)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        (order.financial_status ?? '').toLowerCase() === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {order.financial_status ?? 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-6 py-4 text-sm text-gray-600">
                    {formatDateLabel(order.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

interface RecentProductsCardProps {
  products: ShopifyProduct[];
}

function RecentProductsCard({ products }: RecentProductsCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
        <Package className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Recent Products</h2>
      </div>
      <div className="space-y-4 p-6">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Package className="h-10 w-10 text-gray-300" />
            <p>No products found.</p>
          </div>
        ) : (
          products.slice(0, 4).map(product => (
            <div
              key={product.id}
              className="flex items-center gap-4 rounded-lg border border-transparent p-4 transition-colors hover:border-gray-200 hover:bg-gray-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                {product.images?.[0]?.src ? (
                  <Image
                    src={product.images[0].src}
                    alt={product.title}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{product.title}</h3>
                <p className="text-xs text-gray-500">{product.vendor || 'Unknown vendor'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(product.variants?.[0]?.price)}
                </p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    product.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {product.status ?? 'draft'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatDateLabel(product.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface RecentCustomersCardProps {
  customers: ShopifyCustomer[];
}

function RecentCustomersCard({ customers }: RecentCustomersCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
        <Users className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
      </div>
      <div className="space-y-4 p-6">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Users className="h-10 w-10 text-gray-300" />
            <p>No customers found.</p>
          </div>
        ) : (
          customers.slice(0, 5).map(customer => (
            <div key={customer.id} className="flex items-center gap-4 rounded-lg border border-transparent p-4 hover:border-gray-200 hover:bg-gray-50">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-stone-500 to-stone-700 text-sm font-semibold text-white">
                {formatCustomerInitials(customer)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {formatPersonName(customer.first_name, customer.last_name, 'Customer')}
                </p>
                <p className="text-xs text-gray-500">{customer.email ?? 'No email provided'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500">Orders</p>
                <p className="text-sm font-semibold text-gray-900">{customer.orders_count ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500">Total spent</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(customer.total_spent)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface InventoryLocationsCardProps {
  locations: ShopifyLocation[];
}

function InventoryLocationsCard({ locations }: InventoryLocationsCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4">
        <MapPin className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Inventory Locations</h2>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {locations.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <MapPin className="h-10 w-10 text-gray-300" />
            <p>No inventory locations found.</p>
          </div>
        ) : (
          locations.slice(0, 4).map(location => (
            <div
              key={location.id}
              className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4 transition-all hover:border-stone-200 hover:bg-stone-50"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{location.name}</h3>
                <Badge
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    location.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {location.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p className="font-mono text-gray-700">{location.country_code || 'N/A'}</p>
                {location.address1 ? (
                  <p>
                    {location.address1},{' '}
                    {[location.city, location.zip].filter(Boolean).join(' ') || ''}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface AbandonedCartsCardProps {
  checkouts: ShopifyCheckout[];
}

function AbandonedCartsCard({ checkouts }: AbandonedCartsCardProps) {
  const hasCheckouts = checkouts.length > 0;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Abandoned Carts</h2>
        </div>
        {hasCheckouts ? (
          <span className="text-3xl font-bold text-amber-600">{checkouts.length}</span>
        ) : null}
      </div>
      <div className="p-6">
        {!hasCheckouts ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No abandoned carts</p>
            <p className="text-xs text-gray-500">All customers are completing their purchases!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700">
              View All
            </Button>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Customer
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Email
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Total
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Items
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Abandoned
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {checkouts.slice(0, 5).map(checkout => (
                    <TableRow key={checkout.id} className="transition-colors hover:bg-gray-50">
                      <TableCell className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {checkout.customer
                          ? formatPersonName(
                              checkout.customer.first_name,
                              checkout.customer.last_name,
                              'Customer'
                            )
                          : 'Guest'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-600">
                        {checkout.email ?? 'N/A'}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(checkout.total_price)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-600">
                        {checkout.line_items?.length ?? 0} items
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-600">
                        {formatDateLabel(checkout.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CampaignPerformanceCardProps {
  campaignAnalytics: CampaignAnalytics;
}

function CampaignPerformanceCard({ campaignAnalytics }: CampaignPerformanceCardProps) {
  const hasData = campaignAnalytics.totalCampaigns > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-stone-50 to-amber-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">WhatsApp Campaign Performance</h2>
        </div>
        {hasData && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {campaignAnalytics.totalCampaigns} Campaigns
          </span>
        )}
      </div>
      <div className="p-6">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No campaigns yet</p>
            <p className="text-xs text-gray-500">Create your first WhatsApp campaign to see performance metrics here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                  <Send className="h-3.5 w-3.5" />
                  Messages Sent
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {campaignAnalytics.totalMessagesSent.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Delivery Rate
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {campaignAnalytics.deliveryRate}%
                </p>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                  <Eye className="h-3.5 w-3.5" />
                  Read Rate
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {campaignAnalytics.readRate}%
                </p>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Conversion Rate
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {campaignAnalytics.conversionRate}%
                </p>
              </div>
            </div>

            {campaignAnalytics.campaignRevenue > 0 && (
              <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600">Revenue from Campaigns</p>
                    <p className="mt-1 text-2xl font-bold text-amber-900">
                      {formatCurrency(campaignAnalytics.campaignRevenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600">{campaignAnalytics.totalConverted} conversions</p>
                    <p className="text-xs text-amber-500">from {campaignAnalytics.totalMessagesSent.toLocaleString('en-IN')} messages</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ shopifyConfigured: boolean; whatsappConfigured: boolean; settingsCompleted: boolean; missingConfigs: string[] } | null>(null);
  const router = useRouter();
  const dataRef = useRef<DashboardData | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Load dashboard data function
  const loadDashboardData = useCallback(
    async (isRefresh = false) => {
      if (!isMounted) return;
      const storage = typeof window !== 'undefined' ? getWindowStorage() : null;

      try {
        if (isRefresh || dataRef.current) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const config = StoreConfigManager.getConfig();

        if (!config || !config.shopUrl || !config.accessToken) {
          window.location.href = '/settings?setup=true';
          return;
        }

        const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
        const baseUrl = getBaseUrl();
        const refreshParam = isRefresh ? '&refresh=true' : '';

        // Fetch all data with proper error handling
        const [analyticsRes, ordersRes, productsRes, customersRes, locationsRes, checkoutsRes, campaignAnalyticsRes] =
          await Promise.allSettled([
            fetchWithConfig(`${baseUrl}/api/shopify/analytics?refresh=${isRefresh}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/shopify/orders?limit=10${refreshParam}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/shopify/products?limit=10${refreshParam}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/shopify/customers?limit=10${refreshParam}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/shopify/locations?limit=10${refreshParam}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/shopify/checkouts?limit=10${refreshParam}`, {
              cache: 'no-store',
            }),
            fetchWithConfig(`${baseUrl}/api/campaigns/analytics`, { cache: 'no-store' }),
          ]);

        // Helper: get Response from Promise.allSettled; return null if failed/rejected so we can use fallback without throwing
        const getResponseSafe = (result: PromiseSettledResult<Response>, name: string): Response | null => {
          if (result.status === 'rejected') return null;
          if (!result.value.ok) return null;
          return result.value;
        };

        // Parse responses with fallback on failure (no throw, so no console errors for 5xx)
        let analytics: ShopifyAnalyticsSummary;
        let ordersData: ShopifyOrderListResponse;
        let productsData: ShopifyProductListResponse;
        let customersData: ShopifyCustomerListResponse;
        let locationsData: ShopifyLocationListResponse;
        let checkoutsData: ShopifyCheckoutListResponse;

        const analyticsResSafe = getResponseSafe(analyticsRes, 'analytics');
        if (!analyticsResSafe) {
          analytics = {
            totalRevenue: 0,
            totalOrders: 0,
            totalCustomers: 0,
            averageOrderValue: 0,
            revenueGrowth: 0,
            ordersGrowth: 0,
          };
        } else {
          try {
            analytics = await parseJsonResponse<ShopifyAnalyticsSummary>(analyticsResSafe, 'analytics');
          } catch {
            analytics = {
              totalRevenue: 0,
              totalOrders: 0,
              totalCustomers: 0,
              averageOrderValue: 0,
              revenueGrowth: 0,
              ordersGrowth: 0,
            };
          }
        }

        const ordersResSafe = getResponseSafe(ordersRes, 'orders');
        if (!ordersResSafe) {
          ordersData = { orders: [] };
        } else {
          try {
            ordersData = await parseJsonResponse<ShopifyOrderListResponse>(ordersResSafe, 'orders');
          } catch {
            ordersData = { orders: [] };
          }
        }

        const productsResSafe = getResponseSafe(productsRes, 'products');
        if (!productsResSafe) {
          productsData = { products: [] };
        } else {
          try {
            productsData = await parseJsonResponse<ShopifyProductListResponse>(productsResSafe, 'products');
          } catch {
            productsData = { products: [] };
          }
        }

        const customersResSafe = getResponseSafe(customersRes, 'customers');
        if (!customersResSafe) {
          customersData = { customers: [] };
        } else {
          try {
            customersData = await parseJsonResponse<ShopifyCustomerListResponse>(customersResSafe, 'customers');
          } catch {
            customersData = { customers: [] };
          }
        }

        const locationsResSafe = getResponseSafe(locationsRes, 'locations');
        if (!locationsResSafe) {
          locationsData = { locations: [] };
        } else {
          try {
            locationsData = await parseJsonResponse<ShopifyLocationListResponse>(locationsResSafe, 'locations');
          } catch {
            locationsData = { locations: [] };
          }
        }

        const checkoutsResSafe = getResponseSafe(checkoutsRes, 'checkouts');
        if (!checkoutsResSafe) {
          checkoutsData = { checkouts: [] };
        } else {
          try {
            checkoutsData = await parseJsonResponse<ShopifyCheckoutListResponse>(checkoutsResSafe, 'checkouts');
          } catch {
            checkoutsData = { checkouts: [] };
          }
        }

        const defaultCampaignAnalytics: CampaignAnalytics = {
          totalCampaigns: 0, totalMessagesSent: 0, totalDelivered: 0,
          totalOpened: 0, totalClicked: 0, totalConverted: 0,
          campaignRevenue: 0, deliveryRate: 0, readRate: 0, conversionRate: 0,
        };
        let campaignAnalytics: CampaignAnalytics;
        const campaignAnalyticsResSafe = getResponseSafe(campaignAnalyticsRes, 'campaignAnalytics');
        if (!campaignAnalyticsResSafe) {
          campaignAnalytics = defaultCampaignAnalytics;
        } else {
          try {
            campaignAnalytics = await campaignAnalyticsResSafe.json();
          } catch {
            campaignAnalytics = defaultCampaignAnalytics;
          }
        }

        const lastSynced = Math.max(
          analytics.lastSynced ?? 0,
          ordersData.lastSynced ?? 0,
          productsData.lastSynced ?? 0,
          customersData.lastSynced ?? 0,
          locationsData.lastSynced ?? 0,
          checkoutsData.lastSynced ?? 0,
          Date.now()
        );

        const payload: DashboardData = {
          analytics,
          orders: ordersData.orders ?? [],
          products: productsData.products ?? [],
          customers: customersData.customers ?? [],
          locations: locationsData.locations ?? [],
          checkouts: checkoutsData.checkouts ?? [],
          campaignAnalytics,
          lastSynced,
        };

        setData(payload);

        if (storage) {
          storage.setJSON(SHOPIFY_STORE_DATA_KEY, analytics);
          storage.setJSON(SHOPIFY_ORDERS_KEY, payload.orders);
          storage.setJSON(SHOPIFY_PRODUCTS_KEY, payload.products);
          storage.setJSON(SHOPIFY_CUSTOMERS_KEY, payload.customers);
          storage.setJSON(SHOPIFY_LOCATIONS_KEY, payload.locations);
          storage.setJSON(SHOPIFY_CHECKOUTS_KEY, payload.checkouts);
          storage.set(SHOPIFY_LAST_SYNCED_KEY, String(lastSynced));
        }
      } catch (error) {
        console.error('Error loading dashboard:', getErrorMessage(error, 'Unknown error'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isMounted, router]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storage = getWindowStorage();
      const cachedAnalytics = storage.getJSON<ShopifyAnalyticsSummary | null>(SHOPIFY_STORE_DATA_KEY);
      if (cachedAnalytics) {
        const cachedOrders = storage.getJSON<ShopifyOrder[] | null>(SHOPIFY_ORDERS_KEY, []);
        const cachedProducts = storage.getJSON<ShopifyProduct[] | null>(SHOPIFY_PRODUCTS_KEY, []);
        const cachedCustomers = storage.getJSON<ShopifyCustomer[] | null>(
          SHOPIFY_CUSTOMERS_KEY,
          []
        );
        const cachedLocations = storage.getJSON<ShopifyLocation[] | null>(SHOPIFY_LOCATIONS_KEY, []);
        const cachedCheckouts = storage.getJSON<ShopifyCheckout[] | null>(SHOPIFY_CHECKOUTS_KEY, []);
        const cachedLastSyncedRaw = storage.get(SHOPIFY_LAST_SYNCED_KEY);
        const cachedLastSynced = cachedLastSyncedRaw ? Number(cachedLastSyncedRaw) : undefined;

        setData({
          analytics: cachedAnalytics,
          orders: cachedOrders ?? [],
          products: cachedProducts ?? [],
          customers: cachedCustomers ?? [],
          locations: cachedLocations ?? [],
          checkouts: cachedCheckouts ?? [],
          campaignAnalytics: {
            totalCampaigns: 0, totalMessagesSent: 0, totalDelivered: 0,
            totalOpened: 0, totalClicked: 0, totalConverted: 0,
            campaignRevenue: 0, deliveryRate: 0, readRate: 0, conversionRate: 0,
          },
          lastSynced: cachedLastSynced ?? cachedAnalytics.lastSynced ?? undefined,
        });
        setLoading(false);
      }
    }

    setIsMounted(true);
  }, []);

  // Check settings status
  useEffect(() => {
    const checkSettingsStatus = async () => {
      try {
        const response = await fetch('/api/settings/status');
        const data = await response.json();
        if (data.success) {
          setSettingsStatus(data.status);
        }
      } catch (error) {
        console.error('Error checking settings status:', error);
      }
    };
    
    if (isMounted) {
      checkSettingsStatus();
    }
  }, [isMounted]);

  // Redirect to setup when settings are incomplete (full page so session is applied)
  useEffect(() => {
    if (isMounted && settingsStatus && !settingsStatus.settingsCompleted) {
      window.location.href = '/settings?setup=true';
    }
  }, [isMounted, settingsStatus]);

  // Initial load
  useEffect(() => {
    if (isMounted) {
      loadDashboardData(false);
    }
  }, [isMounted, loadDashboardData]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    console.log('🔄 Configuration changed, reloading dashboard data...');
    loadDashboardData(true);
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await loadDashboardData(true);
  }, { interval: 30000, enabled: true }); // Refresh every 30 seconds

  const handleRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    await loadDashboardData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const config = StoreConfigManager.getConfig();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        <DashboardHeader refreshing={refreshing} onRefresh={handleRefresh} lastSynced={data?.lastSynced} />
        {settingsStatus && !settingsStatus.settingsCompleted && (
          <SettingsIncompleteBanner missingConfigs={settingsStatus.missingConfigs} />
        )}
        <ConnectionStatus shopUrl={config?.shopUrl} />

        {data?.analytics ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(data.analytics.totalRevenue)}
              subtitle="vs last week"
              icon={DollarSign}
              trend={data.analytics.revenueGrowth}
              accent="warm"
            />
            <MetricCard
              title="Total Orders"
              value={data.analytics.totalOrders.toLocaleString('en-IN')}
              subtitle="Total orders processed"
              icon={ShoppingCart}
              trend={data.analytics.ordersGrowth}
              accent="sand"
            />
            <MetricCard
              title="Total Customers"
              value={data.analytics.totalCustomers.toLocaleString('en-IN')}
              subtitle="Active customers"
              icon={Users}
              accent="clay"
            />
            <MetricCard
              title="Average Order Value"
              value={formatCurrency(data.analytics.averageOrderValue)}
              subtitle="Per transaction"
              icon={TrendingUp}
              accent="taupe"
            />
          </div>
        ) : null}

        {data?.campaignAnalytics && (
          <CampaignPerformanceCard campaignAnalytics={data.campaignAnalytics} />
        )}

        <div className="space-y-6 animate-fade-in">
          <RecentOrdersTable orders={data?.orders ?? []} />

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentProductsCard products={data?.products ?? []} />
            <RecentCustomersCard customers={data?.customers ?? []} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <InventoryLocationsCard locations={data?.locations ?? []} />
            <AbandonedCartsCard checkouts={data?.checkouts ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPageClient() {
  return (
    <ConfigurationGuard>
      <DashboardContent />
    </ConfigurationGuard>
  );
}
