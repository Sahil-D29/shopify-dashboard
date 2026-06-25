/**
 * Canonical journey-event identity.
 *
 * Journey triggers store a catalog event id (e.g. `order_placed`,
 * `product_viewed`, `whatsapp_reply_received`, `custom:foo`). Different sources
 * dispatch events under their own native names — Shopify uses webhook topics
 * (`orders/create`), storefront tracking and WhatsApp use catalog ids directly.
 *
 * `normalizeEventName` collapses both the stored trigger value and the incoming
 * dispatched value to the same canonical id so the matcher can compare them with
 * simple equality. This keeps existing journeys (which stored raw Shopify topics)
 * working while new journeys store catalog ids.
 */

/** Shopify webhook topic → canonical catalog event id. */
const SHOPIFY_TOPIC_TO_CATALOG: Record<string, string> = {
  'orders/create': 'order_placed',
  'orders/paid': 'payment_completed',
  'orders/fulfilled': 'order_fulfilled',
  'orders/partially_fulfilled': 'order_fulfilled',
  'orders/cancelled': 'order_cancelled',
  'orders/edited': 'order_placed',
  'fulfillments/create': 'fulfillment_created',
  'fulfillments/update': 'fulfillment_shipped',
  'refunds/create': 'refund_issued',
  'checkouts/create': 'checkout_started',
  'checkouts/update': 'checkout_started',
  'customers/create': 'customer_created',
  'customers/update': 'customer_updated',
  'customers/enable': 'customer_updated',
};

/** Reverse map (catalog id → primary Shopify topic) for sources that need it. */
export const CATALOG_TO_SHOPIFY_TOPIC: Record<string, string> = Object.entries(
  SHOPIFY_TOPIC_TO_CATALOG,
).reduce<Record<string, string>>((acc, [topic, catalogId]) => {
  if (!acc[catalogId]) acc[catalogId] = topic;
  return acc;
}, {});

/**
 * Collapse any event name (Shopify topic, catalog id, custom:* or legacy value)
 * to its canonical catalog id for matching. Unknown names pass through lowercased
 * so equality still works for ids we don't explicitly map.
 */
export function normalizeEventName(name: string | null | undefined): string {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  // custom events keep their full `custom:{name}` identity.
  if (lower.startsWith('custom:')) return lower;
  return SHOPIFY_TOPIC_TO_CATALOG[lower] ?? lower;
}

/** True when two event names refer to the same canonical event. */
export function eventNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeEventName(a) === normalizeEventName(b);
}
