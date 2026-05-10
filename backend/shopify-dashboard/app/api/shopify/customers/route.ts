import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { ShopifyCustomerResponse } from '@/lib/shopify/client';
import type { ShopifyCustomer, ShopifyCustomerListResponse } from '@/lib/types/shopify-customer';
import { cache } from '@/lib/utils/cache';

export const runtime = 'nodejs';

// Explicitly handle unsupported methods (POST is allowed for creating customers)
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface CustomersCacheEntry {
  customers: ShopifyCustomer[];
  lastSynced: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('👥 GET /api/shopify/customers - Fetching from Shopify');
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 10);

    console.log('📋 Request params:', { forceRefresh, limit });

    const cacheKey = `customers_${limit}`;

    if (!forceRefresh) {
      const cached = cache.get<CustomersCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached customers:', cached.customers.length);
        return NextResponse.json({ customers: cached.customers, lastSynced: cached.lastSynced, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);

    console.log('📥 Fetching customers from Shopify...');
    const customers = await client.fetchAll<ShopifyCustomer>('customers', { 
      limit: Math.min(limit, 250) // Shopify max is 250
    });
    console.log(`✅ Fetched ${customers.length} customers from Shopify`);

    // Sort by created_at descending (most recent first) and limit
    const sortedCustomers = customers
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);

    const lastSynced = Date.now();

    console.log(`💾 Caching ${sortedCustomers.length} customers`);
    cache.set<CustomersCacheEntry>(cacheKey, { customers: sortedCustomers, lastSynced });

    const response: ShopifyCustomerListResponse = {
      customers: sortedCustomers,
      lastSynced,
    };

    console.log('✅ Returning customers response');
    return NextResponse.json({ ...response, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/shopify/customers:', {
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
        error: 'Failed to fetch customers',
        message: errorMessage,
        customers: [],
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestData = (await request.json()) as unknown;
    
    // Handle both formats: { customer: {...} } or direct customer data
    const customerData =
      (requestData as { customer?: unknown })?.customer ?? (requestData as ShopifyCustomerResponse['customer']);

    // Validate required fields
    if (
      !customerData ||
      typeof customerData !== 'object' ||
      !(customerData as { first_name?: unknown }).first_name ||
      !(customerData as { last_name?: unknown }).last_name ||
      !(customerData as { email?: unknown }).email
    ) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'First name, last name, and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String((customerData as { email: unknown }).email))) {
      return NextResponse.json(
        { error: 'Invalid email format', message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Create customer via Shopify API
    const client = getShopifyClient(request);
    const response = await client.requestRaw('/customers.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customer: customerData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to create customer', 
          message: `Shopify API error: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      {
        error: 'Failed to create customer',
        message: getErrorMessage(error) || 'An error occurred while creating the customer',
      },
      { status: 500 }
    );
  }
}

