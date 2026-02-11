import { NextRequest, NextResponse } from "next/server";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!SHOP || !ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Missing Shopify env vars", products: [] },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const url = `https://${SHOP}/admin/api/2024-10/products.json?limit=${limit}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Shopify API error ${res.status}:`, text);
      return NextResponse.json(
        { error: `Shopify error ${res.status}`, details: text, products: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('Products API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch products', products: [] },
      { status: 500 }
    );
  }
}


