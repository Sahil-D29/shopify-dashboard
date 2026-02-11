import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const client = getShopifyClient(request);
    
    // Fetch products to extract unique product types
    const data = (await client.getProducts({ limit: 250 })) as any;
    const products = (data.products as any[]) || [];
    
    // Extract unique product types
    const typeSet = new Set<string>();
    products.forEach(product => {
      if (product.product_type && typeof product.product_type === 'string') {
        typeSet.add(product.product_type);
      }
    });
    
    let types = Array.from(typeSet).map(type => ({ type }));
    
    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      types = types.filter(t => t.type.toLowerCase().includes(searchLower));
    }
    
    // Sort alphabetically
    types.sort((a, b) => a.type.localeCompare(b.type));

    return NextResponse.json({ items: types });
  } catch (error) {
    console.error('Error fetching product types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product types', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

