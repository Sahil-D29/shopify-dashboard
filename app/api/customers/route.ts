import { NextRequest, NextResponse } from 'next/server';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import type { Customer } from '@/lib/types/customer';
import type { ShopifyOrder } from '@/lib/shopify/client';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import { cache } from '@/lib/utils/cache';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { getUserContext } from '@/lib/user-context';

export const runtime = 'nodejs';

interface CustomerSummary {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  state: string;
  verified_email: boolean;
  accepts_marketing: boolean;
  marketing_opt_in_level: string | null;
  tax_exempt: boolean;
  tags: string;
  note: string | null;
  addresses: ShopifyCustomer['addresses'];
  created_at: string | null;
  updated_at: string | null;
  last_order_id: number | null;
  last_order_name: string | null;
  last_order_date: string | null;
  aov: number;
}

interface CustomersCacheEntry {
  customers: CustomerSummary[];
  lastSynced: number;
}

interface CustomerCreatePayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  totalOrders?: number;
  totalSpent?: number;
  averageOrderValue?: number;
  lastOrderDate?: number;
  firstOrderDate?: number;
  tags?: string[];
  acceptsMarketing?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  country?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  customerSince?: number;
  lifetimeValue?: number;
  orderFrequency?: Customer['orderFrequency'];
  riskLevel?: Customer['riskLevel'];
  lastSeenAt?: number;
  segments?: string[];
}

const parseLimit = (value: string | null, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatShopifyCustomer = (
  customer: ShopifyCustomer,
  lastOrderMap: Map<number, string>,
): CustomerSummary => {
  const ordersCount = toNumber(customer.orders_count, 0);
  const totalSpent = toNumber(customer.total_spent, 0);
  const averageOrderValue = ordersCount > 0 ? totalSpent / ordersCount : 0;

  return {
    id: customer.id,
    first_name: customer.first_name ?? '',
    last_name: customer.last_name ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? null,
    orders_count: ordersCount,
    total_spent: totalSpent.toString(),
    state: customer.state ?? 'enabled',
    verified_email: Boolean(customer.verified_email),
    accepts_marketing: Boolean((customer as unknown as { accepts_marketing?: boolean }).accepts_marketing),
    marketing_opt_in_level: (customer as unknown as { marketing_opt_in_level?: string | null }).marketing_opt_in_level ?? null,
    tax_exempt: Boolean((customer as unknown as { tax_exempt?: boolean }).tax_exempt),
    tags: customer.tags ?? '',
    note: (customer as unknown as { note?: string | null }).note ?? null,
    addresses: customer.addresses ?? [],
    created_at: customer.created_at ?? null,
    updated_at: customer.updated_at ?? null,
    last_order_id: customer.last_order_id ?? null,
    last_order_name: customer.last_order_name ?? null,
    last_order_date: lastOrderMap.get(customer.id) ?? null,
    aov: Number.isFinite(averageOrderValue) ? averageOrderValue : 0,
  };
};

const buildLastOrderMap = (orders: ShopifyOrder[]): Map<number, string> => {
  const map = new Map<number, string>();
  orders.forEach(order => {
    const customerId = order.customer?.id;
    if (!customerId || !order.processed_at) return;
    const previous = map.get(customerId);
    if (!previous || new Date(order.processed_at) > new Date(previous)) {
      map.set(customerId, order.processed_at);
    }
  });
  return map;
};

const generateCustomerId = (): string => `cust_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return undefined;
};

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 GET /api/customers - Starting request');
    
    // Get user context for authentication
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limit = parseLimit(searchParams.get('limit'), 250);

    console.log('📋 Request params:', { forceRefresh, limit });

    const cacheKey = `customers_${limit}`;

    if (!forceRefresh) {
      const cached = cache.get<CustomersCacheEntry>(cacheKey);
      if (cached) {
        console.log('📦 Returning cached customers:', cached.customers.length);
        return NextResponse.json({ ...cached, cached: true });
      }
    } else {
      cache.delete(cacheKey);
      console.log('🔄 Cache cleared, fetching fresh data');
    }

    console.log('🔗 Getting Shopify client...');
    const client = getShopifyClient(request);
    
    // Check if client has valid config
    const configHeader = request.headers.get('X-Shopify-Config');
    console.log('🔑 Config header present:', !!configHeader);
    
    if (!configHeader) {
      console.warn('⚠️ No X-Shopify-Config header found, using env vars fallback');
    }

    console.log('📥 Fetching customers from Shopify...');
    const shopifyCustomers = await client.fetchAll<ShopifyCustomer>('customers', { limit });
    console.log(`✅ Fetched ${shopifyCustomers.length} customers from Shopify`);

    console.log('📥 Fetching orders from Shopify...');
    const orders = await client.fetchAll<ShopifyOrder>('orders', { status: 'any', limit });
    console.log(`✅ Fetched ${orders.length} orders from Shopify`);

    const lastOrderMap = buildLastOrderMap(orders);
    const customers = shopifyCustomers.map(customer => formatShopifyCustomer(customer, lastOrderMap));
    const lastSynced = Date.now();

    console.log(`💾 Caching ${customers.length} formatted customers`);
    cache.set<CustomersCacheEntry>(cacheKey, { customers, lastSynced });

    console.log('✅ Returning customers response');
    return NextResponse.json({ customers, lastSynced, cached: false });
  } catch (error) {
    console.error('❌ Error in GET /api/customers:', {
      error,
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Return more detailed error information
    const errorMessage = getErrorMessage(error);
    const statusCode = error instanceof Error && 'status' in error 
      ? (error as { status?: number }).status || 500
      : 500;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch customers', 
        message: errorMessage,
        details: errorMessage,
        customers: [], // Return empty array so frontend doesn't crash
        lastSynced: Date.now(),
      },
      { status: statusCode },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user context for authentication
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in' },
        { status: 401 }
      );
    }

    let payload: CustomerCreatePayload;
    try {
      payload = (await request.json()) as CustomerCreatePayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const email = normalizeString(payload?.email);
    const firstName = normalizeString(payload?.firstName);
    const lastName = normalizeString(payload?.lastName);

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, lastName' },
        { status: 400 },
      );
    }

    const customers = readJsonFile<Customer>('customers.json');
    const duplicate = customers.find(customer => customer.email.toLowerCase() === email.toLowerCase());
    if (duplicate) {
      return NextResponse.json({ error: 'Customer with this email already exists' }, { status: 409 });
    }

    const newCustomer: Customer = {
      id: generateCustomerId(),
      email,
      firstName,
      lastName,
      phone: normalizeString(payload.phone),
      totalOrders: toNumber(payload.totalOrders),
      totalSpent: toNumber(payload.totalSpent),
      averageOrderValue: toNumber(payload.averageOrderValue),
      lastOrderDate: toOptionalNumber(payload.lastOrderDate),
      firstOrderDate: toOptionalNumber(payload.firstOrderDate),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      acceptsMarketing: payload.acceptsMarketing ?? true,
      emailVerified: payload.emailVerified ?? false,
      phoneVerified: payload.phoneVerified ?? false,
      country: normalizeString(payload.country),
      city: normalizeString(payload.city),
      state: normalizeString(payload.state),
      zipCode: normalizeString(payload.zipCode),
      customerSince: toNumber(payload.customerSince, Date.now()),
      lifetimeValue: toNumber(payload.lifetimeValue),
      orderFrequency: payload.orderFrequency,
      riskLevel: payload.riskLevel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSeenAt: toOptionalNumber(payload.lastSeenAt),
      segments: Array.isArray(payload.segments) ? payload.segments : [],
    };

    customers.push(newCustomer);
    writeJsonFile('customers.json', customers);

    return NextResponse.json({ customer: newCustomer, success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create customer', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

