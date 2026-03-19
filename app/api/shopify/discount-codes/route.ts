export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClientAsync } from '@/lib/shopify/api-helper';

export const runtime = 'nodejs';

interface PriceRule {
  id: number;
  title: string;
  value: string;
  value_type: string;
}

interface DiscountCode {
  id: number;
  code: string;
  usage_count: number;
  price_rule_id: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let client;
    try {
      client = await getShopifyClientAsync(request);
    } catch {
      // No store connected — return empty list
      return NextResponse.json({ items: [] });
    }

    // Fetch price rules from Shopify
    let priceRules: PriceRule[] = [];
    try {
      priceRules = await client.fetchAll<PriceRule>('price_rules', { limit: 50 });
    } catch (err) {
      console.error('Failed to fetch price rules:', err);
      return NextResponse.json({ items: [] });
    }

    // For each price rule, fetch its discount codes
    const allCodes: Array<{ code: string; label: string }> = [];

    await Promise.all(
      priceRules.map(async (rule) => {
        try {
          const result = await client.fetchNested<{ discount_codes?: DiscountCode[] }>(
            'price_rules',
            rule.id,
            'discount_codes',
          );
          const codes = result?.discount_codes || [];
          for (const dc of codes) {
            const valueLabel = rule.value_type === 'percentage'
              ? `${Math.abs(parseFloat(rule.value))}% off`
              : rule.value_type === 'fixed_amount'
                ? `$${Math.abs(parseFloat(rule.value))} off`
                : rule.title;

            allCodes.push({
              code: dc.code,
              label: `${dc.code} — ${valueLabel}`,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch discount codes for price rule ${rule.id}:`, err);
        }
      })
    );

    // Apply search filter
    const filtered = search
      ? allCodes.filter(c => c.code.toLowerCase().includes(search.toLowerCase()))
      : allCodes;

    return NextResponse.json({ items: filtered });
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discount codes', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
