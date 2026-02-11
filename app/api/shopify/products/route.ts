export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyProductListResponse } from '@/lib/types/shopify-product';
import type { ShopifyProduct } from '@/lib/types/shopify-product';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

interface ProductsCacheEntry {
  products: ShopifyProduct[];
  lastSynced: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🛍️ GET /api/shopify/products - Fetching from Shopify');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 10);

    console.log('📋 Request params:', { forceRefresh, limit });

    const cacheKey = `products_${limit}`;

    if (!forceRefresh) {
      const cached = cache.get<ProductsCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached products:', cached.products.length);
        return NextResponse.json({ products: cached.products, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    console.log('📥 Fetching products from Shopify...');
    const productsResponse = await client.getProducts({ 
      limit: Math.min(limit, 250), // Shopify max is 250
      status: 'active'
    });
    
    // Shopify returns { products: [...] }
    const allProducts = (productsResponse as { products?: ShopifyProduct[] }).products || [];
    console.log(`✅ Fetched ${allProducts.length} products from Shopify`);

    // Sort by created_at descending (most recent first) and limit
    const sortedProducts = allProducts
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);

    const lastSynced = Date.now();

    console.log(`💾 Caching ${sortedProducts.length} products`);
    cache.set<ProductsCacheEntry>(cacheKey, { products: sortedProducts, lastSynced });

    const response: ShopifyProductListResponse = {
      products: sortedProducts,
      lastSynced,
    };

    console.log('✅ Returning products response');
    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/shopify/products:', {
      error,
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorMessage = getErrorMessage(error);
    const statusCode = error instanceof Error && 'status' in error 
      ? (error as { status?: number }).status || 500
      : 500;

    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        message: errorMessage,
        products: [],
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

