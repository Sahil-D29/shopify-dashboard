export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

/**
 * Ensure cache directory exists for a shop
 */
async function ensureCacheDir(shop: string): Promise<string> {
  const shopDir = path.join(CACHE_DIR, shop.replace(/\.myshopify\.com$/, ''));
  try {
    await fs.mkdir(shopDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return shopDir;
}

/**
 * Update cache file for a shop and topic
 */
async function updateCache(shop: string, topic: string, data: any): Promise<void> {
  const shopDir = await ensureCacheDir(shop);
  const cacheFile = path.join(shopDir, `${topic.replace(/\//g, '_')}.json`);
  await fs.writeFile(
    cacheFile,
    JSON.stringify({
      data,
      updatedAt: Date.now(),
      topic,
    }),
    'utf-8'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const hmac = request.headers.get('x-shopify-hmac-sha256') || '';
    const topic = request.headers.get('x-shopify-topic') || '';
    const shop = request.headers.get('x-shopify-shop-domain') || '';

    if (!shop || !topic) {
      return NextResponse.json(
        { error: 'Missing required webhook headers' },
        { status: 400 }
      );
    }

    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiSecret) {
      console.error('SHOPIFY_API_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const isValid = verifyShopifyWebhook(body, hmac, apiSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const data = JSON.parse(body);

    // Update cache based on topic
    await updateCache(shop, topic, data);

    console.log(`✅ Webhook received: ${topic} for ${shop}`);

    // Handle specific topics
    switch (topic) {
      case 'products/create':
      case 'products/update':
        // Cache will be updated, frontend can refresh
        break;
      case 'orders/create':
      case 'orders/updated':
        // Cache will be updated
        break;
      case 'customers/create':
      case 'customers/update':
        // Cache will be updated
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    return NextResponse.json({ ok: true, topic, shop });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    );
  }
}


