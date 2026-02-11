export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import { getShopifyClient } from '@/lib/shopify/api-helper';

const parseLimit = (value: string | null, fallback: number, max = 100): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const splitTags = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    : [];

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const runtime = 'nodejs';

type ShopifyProduct = {
  id: number;
  title: string;
  handle?: string;
  status?: string;
  product_type?: string;
  tags?: string;
  vendor?: string;
  images?: Array<{ src?: string }>;
  variants?: Array<{ price?: string }>;
};

type ShopifyCollection = {
  id: number;
  title: string;
  handle?: string;
  body_html?: string;
  updated_at?: string;
};

type ShopifyMetafield = {
  id: number;
  namespace: string;
  key: string;
  type: string;
  description?: string;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'), 24);
    const client = getShopifyClient(request);

    const [productsPayload, customCollections, smartCollections, metafields] = await Promise.all([
      client.getProducts({ limit, fields: 'id,title,handle,status,product_type,tags,vendor,images,variants' }),
      client.fetchAll('custom_collections', { limit }),
      client.fetchAll('smart_collections', { limit }),
      client.fetchAll('metafields', { limit }),
    ]) as [any, any[], any[], any[]];

    const products = ((productsPayload?.products as any[]) || []).map((product: any) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      productType: product.product_type,
      vendor: product.vendor,
      imageSrc: product.images?.[0]?.src,
      tags: splitTags(product.tags),
      price: product.variants?.[0]?.price ? Number(product.variants[0].price) : undefined,
    }));

    const tags = Array.from(
      new Set(
        products
          .flatMap(product => product.tags)
          .filter(Boolean)
      )
    ).slice(0, 40);

    const collections = [...customCollections, ...smartCollections].map((collection: ShopifyCollection) => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      description: collection.body_html,
      updatedAt: collection.updated_at,
    }));

    const metafieldSummaries = (metafields as ShopifyMetafield[]).map(field => ({
      id: field.id,
      namespace: field.namespace,
      key: field.key,
      type: field.type,
      description: field.description,
    }));

    return NextResponse.json({
      products,
      collections,
      tags,
      metafields: metafieldSummaries,
      lastSynced: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Shopify catalog', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

