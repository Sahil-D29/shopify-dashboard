import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const client = getShopifyClient(request);
    
    // Fetch products to extract unique vendors
    const data = (await client.getProducts({ limit: 250 })) as any;
    const products = (data.products as any[]) || [];
    
    // Extract unique vendors
    const vendorSet = new Set<string>();
    products.forEach(product => {
      if (product.vendor && typeof product.vendor === 'string') {
        vendorSet.add(product.vendor);
      }
    });
    
    let vendors = Array.from(vendorSet).map(name => ({ name }));
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      vendors = vendors.filter(v => v.name.toLowerCase().includes(searchLower));
    }
    
    // Sort alphabetically
    vendors.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ items: vendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendors', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

