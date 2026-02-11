import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const client = getShopifyClient(request);
    
    // Fetch customers to extract unique tags
    // Note: This might be limited by API rate limits, consider caching
    const data = await client.getCustomers({ limit: 250 });
    const customers = (data.customers as any[]) || [];
    
    // Extract unique tags
    const tagSet = new Set<string>();
    customers.forEach(customer => {
      if (customer.tags) {
        const tags = typeof customer.tags === 'string' 
          ? customer.tags.split(',').map((t: string) => t.trim())
          : Array.isArray(customer.tags) 
            ? customer.tags 
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
    console.error('Error fetching customer tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer tags', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

