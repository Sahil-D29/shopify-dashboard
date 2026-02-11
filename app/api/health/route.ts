export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const routes = [
    '/api/shopify/analytics',
    '/api/shopify/orders',
    '/api/shopify/products',
    '/api/shopify/customers',
    '/api/customers',
    '/api/shopify/locations',
    '/api/shopify/checkouts',
  ];

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    routes: routes.map(route => ({
      path: route,
      method: 'GET',
      status: 'available',
    })),
    message: 'All API routes are configured. If you see 405 errors, restart the Next.js server.',
  });
}


