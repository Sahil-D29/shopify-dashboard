import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopify/api-helper';
import type { Customer } from '@/lib/types';

interface TopCustomer {
  id: number;
  name: string;
  total_spent: number;
  orders_count: number;
  last_order_id?: number | null;
  last_order_name?: string | null;
}

const toCurrencyNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOrderCount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(request: Request) {
  try {
    const client = getShopifyClient(request);
    const customersData = await client.getCustomers({ limit: 250 });
    const customers = (customersData.customers ?? []) as Customer[];

    const top: TopCustomer[] = customers
      .map(customer => {
        const fullName = `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
        const customerAny = customer as any;
        return {
          id: customer.id,
          name: fullName || customer.email,
          total_spent: toCurrencyNumber(customer.total_spent),
          orders_count: toOrderCount(customer.orders_count),
          last_order_id: customerAny.last_order_id ?? null,
          last_order_name: customerAny.last_order_name ?? null,
        };
      })
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5);

    return NextResponse.json({ top });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute top customers', message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
