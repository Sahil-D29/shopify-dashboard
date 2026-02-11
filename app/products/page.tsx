'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { ConfigurationGuard } from '@/components/ConfigurationGuard';
import { fetchWithConfig } from '@/lib/fetch-with-config';
import { useConfigRefresh } from '@/hooks/useConfigRefresh';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ShopifyProduct, ShopifyProductListResponse, ShopifyProductVariant } from '@/lib/types/shopify-product';

const formatCurrency = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  return `₹${Number.isFinite(numeric) ? numeric.toLocaleString('en-IN') : '0'}`;
};

const getPriceRange = (variants?: ShopifyProductVariant[]): { min: number; max: number } => {
  if (!variants?.length) {
    return { min: 0, max: 0 };
  }
  const prices = variants
    .map(variant => Number(variant.price ?? 0))
    .filter(value => Number.isFinite(value));
  if (!prices.length) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
};

const getTotalInventory = (variants?: ShopifyProductVariant[]): number =>
  variants?.reduce((sum, variant) => sum + Number(variant.inventory_quantity ?? 0), 0) ?? 0;

function ProductsContent() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const fetchProducts = useCallback(
    async (forceRefresh = false) => {
      if (!isMounted) return;

      setIsRefreshing(forceRefresh);
      setIsLoading(prev => (forceRefresh ? prev : true));

      try {
        const { getBaseUrl } = await import('@/lib/utils/getBaseUrl');
        const baseUrl = getBaseUrl();
        const refreshParam = forceRefresh ? '&refresh=true' : '';
        const res = await fetchWithConfig(`${baseUrl}/api/shopify/products?limit=250${refreshParam}`, {
          cache: 'no-store',
        });
        const payload = (await res.json().catch(() => ({}))) as ShopifyProductListResponse;
        if (!res.ok) {
          throw new Error(payload.error ?? 'Failed to fetch products');
        }
        setProducts(payload.products ?? []);
        setLastSynced(
          typeof payload.lastSynced === 'number' ? payload.lastSynced : Date.now()
        );
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
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
      fetchProducts();
    }
  }, [isMounted, fetchProducts]);

  // Auto-refresh on config change
  useConfigRefresh(() => {
    console.log('🔄 Config changed, reloading products...');
    fetchProducts(true);
  });

  // Auto-refresh every 30 seconds for live syncing
  useAutoRefresh(async () => {
    await fetchProducts(true);
  }, { interval: 30000, enabled: true }); // Refresh every 30 seconds

  const handleRefresh = useCallback(() => {
    fetchProducts(true);
  }, [fetchProducts]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Your product catalog • Live syncing every 30s
            {lastSynced && (
              <span className="ml-2 text-xs text-gray-500">
                • Last synced: {format(new Date(lastSynced), 'MMM dd, yyyy HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{products.length} total</Badge>
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

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground">
              Products will appear here once they are added to your store.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(product => {
            const image = product.images?.[0]?.src;
            const { min, max } = getPriceRange(product.variants);
            const totalInventory = getTotalInventory(product.variants);

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader className="p-0">
                  {image ? (
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={image}
                        alt={product.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-gray-100">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <h3 className="mb-1 line-clamp-2 font-semibold">{product.title}</h3>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {product.vendor ?? '—'} • {product.product_type ?? '—'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                      {product.status ?? 'draft'}
                    </Badge>
                    <span>ID: {product.id}</span>
                    <span>Variants: {product.variants?.length ?? 0}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between p-4 pt-0">
                  <span className="text-sm font-semibold">
                    {min === max
                      ? formatCurrency(min)
                      : `${formatCurrency(min)} - ${formatCurrency(max)}`}
                  </span>
                  <Badge variant={totalInventory > 0 ? 'default' : 'destructive'}>
                    {totalInventory} in stock
                  </Badge>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ConfigurationGuard>
      <ProductsContent />
    </ConfigurationGuard>
  );
}
