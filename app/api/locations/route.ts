export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { resolveStore } from '@/lib/tenant/resolve-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const store = await resolveStore(request);
    if (!store) {
      return NextResponse.json(
        { error: "No Shopify store connected. Please connect a store first.", locations: [] },
        { status: 400 }
      );
    }

    const url = `https://${store.shop}/admin/api/${store.apiVersion}/locations.json`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": store.token,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Shopify API error ${res.status} for ${store.shop}:`, text);
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
