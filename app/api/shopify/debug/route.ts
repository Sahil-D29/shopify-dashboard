export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoreIdFromRequest } from '@/lib/tenant/tenant-utils';
import { getDecryptedToken } from '@/lib/shopify-token';
import { getUserContext } from '@/lib/user-context';

/**
 * GET /api/shopify/debug
 * Diagnostic endpoint — checks the full store resolution + Shopify API chain.
 * Returns status at each step so you can see exactly where it breaks.
 */
export async function GET(request: NextRequest) {
  const steps: Record<string, unknown> = {};

  // Step 1: Auth
  try {
    const userContext = await getUserContext(request);
    steps.auth = userContext
      ? { ok: true, email: userContext.email, userId: userContext.userId }
      : { ok: false, error: 'No user session' };
  } catch (e) {
    steps.auth = { ok: false, error: String(e) };
  }

  // Step 2: Store ID resolution
  const storeId = getStoreIdFromRequest(request);
  steps.storeId = storeId
    ? { ok: true, storeId, source: request.headers.get('x-store-id') ? 'header' : 'cookie/query' }
    : { ok: false, error: 'No store ID found (no cookie, header, or query param)' };

  if (!storeId) {
    return NextResponse.json({ steps, summary: 'FAILED at store ID resolution' });
  }

  // Step 3: Prisma lookup
  let store: { id: string; shopifyDomain: string | null; accessToken: string | null; isActive: boolean; storeName: string | null } | null = null;
  try {
    store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, shopifyDomain: true, accessToken: true, isActive: true, storeName: true },
    });
    steps.prismaLookup = store
      ? {
          ok: true,
          storeName: store.storeName,
          shopifyDomain: store.shopifyDomain,
          isActive: store.isActive,
          hasAccessToken: !!store.accessToken,
          tokenLength: store.accessToken?.length || 0,
          tokenPreview: store.accessToken ? store.accessToken.substring(0, 10) + '...' : null,
        }
      : { ok: false, error: `No store found with id=${storeId}` };
  } catch (e) {
    steps.prismaLookup = { ok: false, error: String(e) };
  }

  if (!store || !store.accessToken || !store.shopifyDomain) {
    return NextResponse.json({ steps, summary: 'FAILED at Prisma lookup' });
  }

  // Step 4: Token decryption
  let decryptedToken = '';
  try {
    decryptedToken = getDecryptedToken({ accessToken: store.accessToken });
    steps.tokenDecrypt = {
      ok: !!decryptedToken,
      tokenLength: decryptedToken.length,
      startsWithShpat: decryptedToken.startsWith('shpat_'),
      preview: decryptedToken ? decryptedToken.substring(0, 10) + '...' : null,
    };
  } catch (e) {
    steps.tokenDecrypt = { ok: false, error: String(e) };
  }

  if (!decryptedToken) {
    return NextResponse.json({ steps, summary: 'FAILED at token decryption' });
  }

  // Step 5: Shopify API test — call shop.json
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-10';
  try {
    const shopRes = await fetch(
      `https://${store.shopifyDomain}/admin/api/${apiVersion}/shop.json`,
      { headers: { 'X-Shopify-Access-Token': decryptedToken } },
    );
    if (shopRes.ok) {
      const shopData = await shopRes.json();
      steps.shopifyShopApi = { ok: true, shopName: shopData.shop?.name, plan: shopData.shop?.plan_name };
    } else {
      const errText = await shopRes.text().catch(() => '');
      steps.shopifyShopApi = { ok: false, status: shopRes.status, statusText: shopRes.statusText, body: errText.substring(0, 200) };
    }
  } catch (e) {
    steps.shopifyShopApi = { ok: false, error: String(e) };
  }

  // Step 6: Shopify customers API test
  try {
    const custRes = await fetch(
      `https://${store.shopifyDomain}/admin/api/${apiVersion}/customers.json?limit=1`,
      { headers: { 'X-Shopify-Access-Token': decryptedToken } },
    );
    if (custRes.ok) {
      const custData = await custRes.json();
      const firstCustomer = custData.customers?.[0];
      steps.shopifyCustomersApi = {
        ok: true,
        count: custData.customers?.length || 0,
        // Show actual fields from first customer to diagnose missing data
        sampleCustomer: firstCustomer ? {
          id: firstCustomer.id,
          email: firstCustomer.email,
          first_name: firstCustomer.first_name,
          last_name: firstCustomer.last_name,
          phone: firstCustomer.phone,
          orders_count: firstCustomer.orders_count,
          total_spent: firstCustomer.total_spent,
          state: firstCustomer.state,
          verified_email: firstCustomer.verified_email,
          tags: firstCustomer.tags,
          availableFields: Object.keys(firstCustomer),
        } : null,
      };
    } else {
      const errText = await custRes.text().catch(() => '');
      steps.shopifyCustomersApi = { ok: false, status: custRes.status, statusText: custRes.statusText, body: errText.substring(0, 200) };
    }
  } catch (e) {
    steps.shopifyCustomersApi = { ok: false, error: String(e) };
  }

  // Step 7: Shopify orders API test
  try {
    const ordRes = await fetch(
      `https://${store.shopifyDomain}/admin/api/${apiVersion}/orders.json?limit=1&status=any`,
      { headers: { 'X-Shopify-Access-Token': decryptedToken } },
    );
    if (ordRes.ok) {
      const ordData = await ordRes.json();
      steps.shopifyOrdersApi = { ok: true, count: ordData.orders?.length || 0 };
    } else {
      const errText = await ordRes.text().catch(() => '');
      steps.shopifyOrdersApi = { ok: false, status: ordRes.status, statusText: ordRes.statusText, body: errText.substring(0, 200) };
    }
  } catch (e) {
    steps.shopifyOrdersApi = { ok: false, error: String(e) };
  }

  // Step 8: Check registered webhooks
  try {
    const whRes = await fetch(
      `https://${store.shopifyDomain}/admin/api/${apiVersion}/webhooks.json`,
      { headers: { 'X-Shopify-Access-Token': decryptedToken } },
    );
    if (whRes.ok) {
      const whData = await whRes.json();
      const topics = (whData.webhooks || []).map((w: { topic: string; address: string }) => ({
        topic: w.topic,
        address: w.address,
      }));
      steps.webhooks = { ok: true, count: topics.length, topics };
    } else {
      steps.webhooks = { ok: false, status: whRes.status };
    }
  } catch (e) {
    steps.webhooks = { ok: false, error: String(e) };
  }

  // Step 9: Check access scopes on the token
  try {
    const scopeRes = await fetch(
      `https://${store.shopifyDomain}/admin/oauth/access_scopes.json`,
      { headers: { 'X-Shopify-Access-Token': decryptedToken } },
    );
    if (scopeRes.ok) {
      const scopeData = await scopeRes.json();
      steps.accessScopes = {
        ok: true,
        scopes: (scopeData.access_scopes || []).map((s: { handle: string }) => s.handle),
      };
    } else {
      steps.accessScopes = { ok: false, status: scopeRes.status };
    }
  } catch (e) {
    steps.accessScopes = { ok: false, error: String(e) };
  }

  const allOk = Object.values(steps).every((s: any) => s.ok);
  return NextResponse.json({ steps, summary: allOk ? 'ALL OK' : 'SOME STEPS FAILED' });
}
