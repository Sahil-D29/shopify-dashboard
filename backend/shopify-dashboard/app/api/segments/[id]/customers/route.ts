import { NextRequest, NextResponse } from 'next/server';
import type { Customer } from '@/lib/types/customer';
import type { CustomerSegment } from '@/lib/types/segment';
import type { ShopifyCustomer } from '@/lib/types/shopify-customer';
import { readJsonFile } from '@/lib/utils/json-storage';
import { matchesGroups } from '@/lib/segments/evaluator';
import { mapShopifyToUiCustomer } from '@/lib/segments/mapper';

// Ensure this route runs on Node.js runtime (not edge)
export const runtime = 'nodejs';

interface RouteParams {
  id: string;
}

interface SegmentCustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

const resolveParams = async (params: RouteParams | Promise<RouteParams>): Promise<RouteParams> =>
  params instanceof Promise ? params : Promise.resolve(params);

const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const mapShopifyToCustomer = (shopifyCustomer: ShopifyCustomer): Customer => {
  const ui = mapShopifyToUiCustomer(shopifyCustomer);
  return {
    ...ui,
    email: ui.email ?? '',
    segments: [],
  };
};

const filterBySearch = (customers: Customer[], search: string): Customer[] => {
  if (!search.trim()) return customers;
  const lookup = search.toLowerCase();
  return customers.filter(customer => {
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const email = customer.email.toLowerCase();
    const phone = customer.phone ?? '';
    return fullName.includes(lookup) || email.includes(lookup) || phone.includes(search);
  });
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  try {
    const { id: segmentId } = await resolveParams(params);
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 20);
    const search = searchParams.get('search') ?? '';

    const segments = readJsonFile<CustomerSegment>('segments.json');

    const segment = segments.find(s => s.id === segmentId);
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }
    const hasConditions = segment.conditionGroups?.some(group => (group.conditions?.length ?? 0) > 0) ?? false;

    const { getShopifyClient } = await import('@/lib/shopify/api-helper');
    const client = getShopifyClient(request);
    const shopifyCustomers = await client.fetchAll<ShopifyCustomer>('customers', { limit: 250 });

    const matchedShopifyCustomers = !hasConditions || segment.name.toLowerCase() === 'all'
      ? shopifyCustomers
      : shopifyCustomers.filter(customer => {
          try {
            return matchesGroups(customer, segment.conditionGroups ?? []);
          } catch (error) {
            console.error('[Segments][Customers] Failed to evaluate customer', customer.id, error);
            return false;
          }
        });

    const uniqueCustomers = new Map<string, Customer>();
    matchedShopifyCustomers.forEach(customer => {
      const mapped = mapShopifyToCustomer(customer);
      uniqueCustomers.set(mapped.id, mapped);
    });

    const dedupedCustomers = filterBySearch(Array.from(uniqueCustomers.values()), search);

    const total = dedupedCustomers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = dedupedCustomers.slice(startIndex, endIndex);

    const response: SegmentCustomersResponse = {
      customers: paginatedCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: endIndex < total,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Segments][Customers] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
  }
}

