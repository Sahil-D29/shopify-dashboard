import { prisma } from '@/lib/prisma';
import { journeyShopifyClient } from './store-client';
import { issue, SendValidationError } from '@/lib/whatsapp/issues';
import { resolveTemplate } from '@/lib/whatsapp/template-send';
import type { TemplateInput } from '@/lib/whatsapp/template-payload';
import type { JourneyEnrollmentRecord } from './storage';

export function checkoutKey(event: Record<string, any>): string | undefined {
  const value = event.cart_token ?? event.checkout_token ?? event.cart_id;
  return value == null ? undefined : String(value).split('?')[0];
}

export const PURCHASE_QUERY = `query JourneyPurchaseCheck($query: String!) {
  orders(first: 10, query: $query) { nodes { id cartToken checkoutToken email createdAt } }
}`;

export async function checkoutPurchased(storeId: string, event: Record<string, any>): Promise<boolean> {
  const key = checkoutKey(event);
  if (!key) throw new SendValidationError([issue('MISSING_CHECKOUT_ID', 'This checkout has no identifier for purchase verification.', 'triggerEvent.cart_token')]);
  const client = await journeyShopifyClient(storeId);
  const actualToken = event.cart_token ?? event.checkout_token;
  const email = typeof event.email === 'string' ? event.email.trim().toLowerCase() : '';
  const since = Date.parse(event.created_at ?? '');
  if (!actualToken && (!email || !Number.isFinite(since))) throw new SendValidationError([issue('PURCHASE_CHECK_UNAVAILABLE', 'This checkout needs a cart token, or email and creation time, to verify purchases.', 'triggerEvent.cart_token')]);
  const token = JSON.stringify(key);
  const query = actualToken ? `(cart_token:${token} OR checkout_token:${token})` : `email:${JSON.stringify(email)} created_at:>=${JSON.stringify(new Date(since).toISOString())}`;
  const result = await client.request<any>('/graphql.json', { method: 'POST', body: JSON.stringify({ query: PURCHASE_QUERY, variables: { query } }) });
  if (result.errors?.length || !Array.isArray(result.data?.orders?.nodes)) throw new Error('Purchase lookup unavailable');
  // With no token, conservatively suppress reminders after any purchase by this checkout email.
  return result.data.orders.nodes.some((order: any) => actualToken
    ? order.cartToken?.split('?')[0] === key || order.checkoutToken === key
    : order.email?.toLowerCase() === email && Date.parse(order.createdAt) >= since);
}

export function recoverySuffix(url: string, approvedUrl: string): string {
  const prefix = approvedUrl.split('{{')[0];
  if (!/^https:\/\//.test(url) || !approvedUrl.endsWith('{{1}}') || !url.startsWith(prefix) || url.length <= prefix.length) {
    throw new SendValidationError([issue('INVALID_RECOVERY_LINK', 'The checkout recovery link does not match this template’s approved button URL.', 'buttonActions.0')]);
  }
  return url.slice(prefix.length);
}

export async function checkoutTemplateInput(storeId: string, input: TemplateInput, event: Record<string, any>) {
  const definition = await resolveTemplate(storeId, input);
  const buttons = definition.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];
  const index = buttons.findIndex(b => b.type === 'URL' && b.url?.includes('{{1}}'));
  if (index < 0 || typeof event.checkout_url !== 'string') throw new SendValidationError([issue('MISSING_RECOVERY_LINK', 'Choose a template with a dynamic recovery button and provide the checkout URL.', 'buttonActions')]);
  return { ...input, buttonActions: { ...input.buttonActions, [String(index)]: recoverySuffix(event.checkout_url, buttons[index].url!) } };
}

export async function cancelPurchasedCheckouts(storeId: string, order: Record<string, any>) {
  const keys = [order.cart_token, order.checkout_token].filter(Boolean).map(v => String(v).split('?')[0]);
  const claims = await prisma.journeyEntryClaim.findMany({ where: { storeId, ...(order.email ? {} : { checkoutKey: { in: keys } }) } });
  for (const claim of claims) {
    await prisma.$transaction(async tx => {
      const doc = await tx.journeyEnrollmentDoc.findUnique({ where: { id: claim.enrollmentId } });
      if (!doc || !['active', 'waiting'].includes(doc.status)) return;
      const data = doc.data as unknown as JourneyEnrollmentRecord;
      const event = data.context?.triggerEvent as Record<string, any> | undefined;
      const sameEmailPurchase = !event?.cart_token && !event?.checkout_token && event?.email && String(order.email ?? '').toLowerCase() === String(event.email).toLowerCase() && Date.parse(order.created_at) >= Date.parse(event.created_at);
      if (!keys.includes(claim.checkoutKey) && !sameEmailPurchase) return;
      await tx.journeyEnrollmentDoc.update({ where: { id: doc.id }, data: { status: 'exited', data: JSON.parse(JSON.stringify({ ...data, status: 'exited', exitReason: 'purchase_completed', completedAt: new Date().toISOString() })) } });
      await tx.journeyScheduleDoc.updateMany({ where: { enrollmentId: doc.id, status: 'pending' }, data: { status: 'cancelled' } });
      await tx.journeyActivityDoc.create({ data: { id: crypto.randomUUID(), enrollmentId: doc.id, data: { id: crypto.randomUUID(), enrollmentId: doc.id, timestamp: new Date().toISOString(), eventType: 'journey_cancelled', data: { reason: 'purchase_completed', orderId: String(order.id) } } } });
    });
  }
}
