export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { resolveStore } from '@/lib/tenant/resolve-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const store = await resolveStore(request);
    if (!store) {
      return NextResponse.json(
        { error: "No Shopify store connected. Please connect a store first." },
        { status: 400 }
      );
    }

    const { shop, token, apiVersion } = store;

    // Aggregate analytics from orders, products, and customers
    const [ordersRes, productsRes, customersRes] = await Promise.all([
      fetch(`https://${shop}/admin/api/${apiVersion}/orders.json?limit=250&status=any`, {
        headers: { "X-Shopify-Access-Token": token },
      }),
      fetch(`https://${shop}/admin/api/${apiVersion}/products.json?limit=250`, {
        headers: { "X-Shopify-Access-Token": token },
      }),
      fetch(`https://${shop}/admin/api/${apiVersion}/customers.json?limit=250`, {
        headers: { "X-Shopify-Access-Token": token },
      }),
    ]);

    const orders = ordersRes.ok ? await ordersRes.json() : { orders: [] };
    const products = productsRes.ok ? await productsRes.json() : { products: [] };
    const customers = customersRes.ok ? await customersRes.json() : { customers: [] };

    // Calculate metrics
    const totalRevenue = orders.orders?.reduce((sum: number, order: any) => {
      return sum + parseFloat(order.total_price || 0);
    }, 0) || 0;

    const totalOrders = orders.orders?.length || 0;
    const totalCustomers = customers.customers?.length || 0;
    const totalProducts = products.products?.length || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      averageOrderValue,
      lastSynced: Date.now(),
    }, { status: 200 });
  } catch (err: any) {
    console.error('Analytics API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to calculate analytics' },
      { status: 500 }
    );
  }
}
