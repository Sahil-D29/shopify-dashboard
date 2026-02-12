export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext } from '@/lib/user-context';
import { getShopifyClient } from '@/lib/shopify/api-helper';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('91') && digits.length >= 12) return '+' + digits;
  if (digits.length === 10) return '+91' + digits;
  return '+' + digits;
}

interface ShopifyCustomerRaw {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  tags?: string;
}

// POST /api/contacts/sync-shopify - Sync Shopify customers to contacts
export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await getCurrentStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const overwrite = body.overwrite === true;

    const shopifyClient = getShopifyClient(request);

    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    let nextUrl: string | null = '/customers.json?limit=250';

    while (nextUrl) {
      const response = await shopifyClient.requestRaw(nextUrl);
      const data = await response.json();
      const customers: ShopifyCustomerRaw[] = data.customers || [];

      for (const customer of customers) {
        try {
          if (!customer.phone) {
            continue;
          }

          const phone = normalizePhone(customer.phone);
          const firstName = customer.first_name || null;
          const lastName = customer.last_name || null;
          const name = firstName || lastName
            ? `${firstName || ''} ${lastName || ''}`.trim()
            : null;
          const email = customer.email || null;
          const tags = customer.tags
            ? customer.tags.split(',').map(t => t.trim()).filter(Boolean)
            : [];
          const shopifyCustomerId = String(customer.id);

          const existing = await prisma.contact.findUnique({
            where: { storeId_phone: { storeId, phone } },
          });

          if (existing) {
            // Only update if overwrite is true or contact was originally from Shopify
            if (overwrite || existing.source === 'SHOPIFY') {
              await prisma.contact.update({
                where: { id: existing.id },
                data: {
                  name: name || existing.name,
                  email: email || existing.email,
                  firstName: firstName || existing.firstName,
                  lastName: lastName || existing.lastName,
                  tags: tags.length > 0 ? tags : (existing.tags as any),
                  shopifyCustomerId,
                  source: 'SHOPIFY',
                },
              });
              updated++;
            }
          } else {
            await prisma.contact.create({
              data: {
                storeId,
                phone,
                name,
                email,
                firstName,
                lastName,
                tags,
                source: 'SHOPIFY',
                shopifyCustomerId,
                optInStatus: 'NOT_SET',
                customFields: {},
              },
            });
            created++;
          }

          synced++;
        } catch (customerError) {
          errors.push(
            `Customer ${customer.id}: ${customerError instanceof Error ? customerError.message : 'Unknown error'}`
          );
        }
      }

      // Parse Link header for pagination
      const linkHeader = response.headers.get('Link') || response.headers.get('link') || '';
      nextUrl = parseLinkHeaderNext(linkHeader);
    }

    return NextResponse.json({
      synced,
      created,
      updated,
      errors,
    });
  } catch (error) {
    console.error('[Contacts Sync Shopify] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync Shopify customers' },
      { status: 500 }
    );
  }
}

/**
 * Parse the Link header to extract the next page URL.
 * Shopify returns Link headers like:
 * <https://shop.myshopify.com/admin/api/2024-10/customers.json?page_info=abc&limit=250>; rel="next"
 */
function parseLinkHeaderNext(linkHeader: string): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match && match[1]) {
      // Extract just the path + query from the full URL
      try {
        const url = new URL(match[1]);
        return url.pathname.replace(/^\/admin\/api\/[^/]+/, '') + url.search;
      } catch {
        return null;
      }
    }
  }

  return null;
}
