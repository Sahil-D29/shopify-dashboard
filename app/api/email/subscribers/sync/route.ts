export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getShopifyClientAsync } from '@/lib/shopify/api-helper';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const MAX_PAGES = 20; // Safety cap: 20 pages * 250 = up to 5000 customers per sync

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    let storeId: string | null;
    if (storeFilter.allowAll) {
      storeId = requestedStoreId || userContext.storeId || null;
    } else {
      storeId = storeFilter.storeId || null;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    let shopifyClient;
    try {
      shopifyClient = await getShopifyClientAsync(request);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Shopify not connected. Connect a Shopify store in Settings first.',
          details: getErrorMessage(error),
        },
        { status: 400 },
      );
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let sinceId: string | undefined;
    const now = new Date();

    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await shopifyClient.getCustomers({ limit: 250, since_id: sinceId });
      const customers = result.customers ?? [];
      if (customers.length === 0) break;

      for (const c of customers) {
        const email = c.email?.trim().toLowerCase();
        if (!email) {
          skipped++;
          continue;
        }

        // Shopify customer.state values: enabled, disabled, invited, declined
        // verified_email indicates email is confirmed
        const isOptedOut = c.state === 'declined' || c.state === 'disabled';

        try {
          const existing = await prisma.emailSubscriber.findUnique({
            where: { storeId_email: { storeId, email } },
          });

          const data = {
            firstName: c.first_name ?? null,
            lastName: c.last_name ?? null,
            shopifyCustomerId: String(c.id),
            syncedFromShopifyAt: now,
            source: 'SHOPIFY' as const,
          };

          if (existing) {
            // Preserve user-set status; only sync demographic data + shopifyCustomerId.
            await prisma.emailSubscriber.update({
              where: { id: existing.id },
              data,
            });
            updated++;
          } else {
            await prisma.emailSubscriber.create({
              data: {
                ...data,
                storeId,
                email,
                status: isOptedOut ? 'UNSUBSCRIBED' : 'SUBSCRIBED',
                unsubscribedAt: isOptedOut ? now : null,
                tags: c.tags
                  ? c.tags
                      .split(',')
                      .map(t => t.trim())
                      .filter(Boolean)
                  : [],
              },
            });
            imported++;
          }
        } catch (innerError) {
          console.warn('[Subscribers sync] Failed for', email, getErrorMessage(innerError));
          skipped++;
        }
      }

      // Use last customer ID for pagination (since_id cursor)
      const last = customers[customers.length - 1];
      if (!last || customers.length < 250) break;
      sinceId = String(last.id);
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      syncedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Email Subscribers][SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync from Shopify', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
