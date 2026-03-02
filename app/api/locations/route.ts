export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getClientCredentialsToken } from '@/lib/shopify/cc-token-provider';

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!SHOP) {
      return NextResponse.json(
        { error: "Missing SHOPIFY_STORE_DOMAIN env var", locations: [] },
        { status: 500 }
      );
    }

    const token = await getClientCredentialsToken();
    const url = `https://${SHOP}/admin/api/${API_VERSION}/locations.json`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Shopify API error ${res.status}:`, text);
      return NextResponse.json(
        { error: `Shopify error ${res.status}`, details: text, locations: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('Locations API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch locations', locations: [] },
      { status: 500 }
    );
  }
}


