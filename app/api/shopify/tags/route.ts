export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const client = getShopifyClient(request);
    
    // Fetch products to extract unique tags
    const data = (await client.getProducts({ limit: 250 })) as any;
    const products = (data.products as any[]) || [];
    
    // Extract unique tags
    const tagSet = new Set<string>();
    products.forEach(product => {
      if (product.tags) {
        const tags = typeof product.tags === 'string' 
          ? product.tags.split(',').map((t: string) => t.trim())
          : Array.isArray(product.tags) 
            ? product.tags 
            : [];
        tags.forEach((tag: string) => {
          if (tag) tagSet.add(tag);
        });
      }
    });
    
    let tags = Array.from(tagSet).map(tag => ({ tag }));
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      tags = tags.filter(t => t.tag.toLowerCase().includes(searchLower));
    }
    
    // Sort alphabetically
    tags.sort((a, b) => a.tag.localeCompare(b.tag));

    return NextResponse.json({ items: tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

