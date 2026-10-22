import crypto from 'crypto';

export interface ShiprocketContact {
  phone?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  customFields?: Record<string, unknown>;
}

export interface ParsedShiprocketAbandonedCart {
  eventName: 'abandoned_cart';
  displayName: 'Abandoned Cart';
  contact: ShiprocketContact | null;
  properties: Record<string, unknown>;
  occurredAt?: string;
  resourceId?: string;
  resourceTitle?: string;
  sessionId?: string;
}

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const primitiveEntries = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      value == null || ['string', 'number', 'boolean'].includes(typeof value),
    ),
  );

/** True only for the cart payload sent by Fastrr/Shiprocket's abandoned-cart webhook. */
export function isShiprocketAbandonedCartPayload(payload: unknown): payload is Record<string, unknown> {
  const body = objectValue(payload);
  return Boolean(
    firstString(body.cart_id, body.cart_token) &&
      firstString(body.checkout_url) &&
      (Array.isArray(body.items) || body.total_price != null || body.item_count != null),
  );
}

/** Convert Shiprocket's top-level cart payload into DorZa's contact + event contract. */
export function parseShiprocketAbandonedCart(
  payload: unknown,
): ParsedShiprocketAbandonedCart | null {
  if (!isShiprocketAbandonedCartPayload(payload)) return null;

  const body = payload as Record<string, unknown>;
  const billing = objectValue(body.billing_address);
  const shipping = objectValue(body.shipping_address);
  const phone = firstString(body.phone_number, body.phone, billing.phone, shipping.phone);
  const email = firstString(body.email, billing.email, shipping.email);
  const firstName = firstString(body.first_name, billing.first_name, shipping.first_name);
  const lastName = firstString(body.last_name, billing.last_name, shipping.last_name);
  const name = firstString(
    body.name,
    billing.name,
    shipping.name,
    [firstName, lastName].filter(Boolean).join(' '),
  );
  const address = Object.keys(billing).length ? billing : shipping;

  const customFields: Record<string, unknown> = {};
  const city = firstString(address.city);
  const state = firstString(address.state);
  const postal = firstString(address.zip, address.postal);
  const country = firstString(address.country, address.country_code);
  if (city) customFields.city = city;
  if (state) customFields.state = state;
  if (postal) customFields.postal = postal;
  if (country) customFields.country = country;

  const items = Array.isArray(body.items) ? body.items : [];
  const itemNames = items
    .map(item => firstString(objectValue(item).title, objectValue(item).name))
    .filter((value): value is string => Boolean(value));
  const resourceTitle = itemNames.length
    ? itemNames.slice(0, 3).join(', ')
    : firstString(Array.isArray(body.item_title_list) ? body.item_title_list[0] : undefined);

  const properties: Record<string, unknown> = {
    ...primitiveEntries(body),
    items,
    billing_address: billing,
    shipping_address: shipping,
  };

  return {
    eventName: 'abandoned_cart',
    displayName: 'Abandoned Cart',
    contact: phone || email
      ? { phone, email, name, firstName, lastName, customFields }
      : null,
    properties,
    occurredAt: firstString(body.updated_at, body.created_at),
    resourceId: firstString(body.cart_id, body.cart_token),
    resourceTitle,
    sessionId: firstString(body.cart_token, body.cart_id),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Stable across Shiprocket retries and reusable for generic webhook payloads. */
export function webhookFingerprint(
  integrationId: string,
  eventName: string,
  payload: Record<string, unknown>,
): string {
  const cartIdentity = firstString(payload.cart_id, payload.cart_token);
  const version = firstString(payload.updated_at, payload.created_at);
  const source = cartIdentity
    ? `${integrationId}:${eventName}:${cartIdentity}:${version || ''}`
    : `${integrationId}:${eventName}:${stableSerialize(payload)}`;
  return crypto.createHash('sha256').update(source).digest('hex');
}
