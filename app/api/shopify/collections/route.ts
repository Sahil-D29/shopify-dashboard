export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const client = getShopifyClient(request);
    
    // Fetch collections (both custom and smart collections)
    const [customCollections, smartCollections] = await Promise.all([
      client.fetchAll('custom_collections', { limit: 250 }).catch(() => []),
      client.fetchAll('smart_collections', { limit: 250 }).catch(() => []),
    ]);
    
    // Combine and format collections
    const allCollections = [
      ...(Array.isArray(customCollections) ? customCollections : []),
      ...(Array.isArray(smartCollections) ? smartCollections : []),
    ];
    
    let collections = allCollections.map((collection: any) => ({
      id: String(collection.id),
      title: collection.title || 'Untitled Collection',
    }));
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      collections = collections.filter(c => c.title.toLowerCase().includes(searchLower));
    }
    
    // Sort alphabetically
    collections.sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ items: collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

