import assert from 'node:assert/strict';
import test from 'node:test';
import { isShiprocketAbandonedCartPayload, parseShiprocketAbandonedCart, webhookFingerprint } from '../shiprocket';
import { normalizePhone } from '../../whatsapp/normalize-phone';

const payload = {
  cart_id: 'cart_fixture_123',
  cart_token: 'token_fixture_123',
  checkout_url: 'https://checkout.example.test/cart_fixture_123',
  phone_number: '98765 43210',
  email: 'PERSON@EXAMPLE.TEST',
  first_name: 'Test',
  last_name: 'Person',
  total_price: 1299,
  currency: 'INR',
  item_count: 1,
  latest_stage: 'checkout',
  updated_at: '2026-10-22T10:07:22.000Z',
  items: [{ title: 'Fixture product', quantity: 1, price: 1299 }],
};

test('recognizes and normalizes the Shiprocket abandoned-cart shape', () => {
  assert.equal(isShiprocketAbandonedCartPayload(payload), true);
  const parsed = parseShiprocketAbandonedCart(payload);
  assert.ok(parsed);
  assert.equal(parsed.eventName, 'abandoned_cart');
  assert.equal(parsed.displayName, 'Abandoned Cart');
  assert.equal(parsed.contact?.phone, '98765 43210');
  assert.equal(normalizePhone(parsed.contact?.phone || ''), '919876543210');
  assert.equal(parsed.contact?.email, 'PERSON@EXAMPLE.TEST');
  assert.equal(parsed.contact?.name, 'Test Person');
  assert.equal(parsed.resourceId, 'cart_fixture_123');
  assert.equal(parsed.resourceTitle, 'Fixture product');
  assert.equal(parsed.properties.checkout_url, payload.checkout_url);
});

test('retry fingerprint is stable and a later cart update has a new fingerprint', () => {
  const first = webhookFingerprint('integration_fixture', 'abandoned_cart', payload);
  assert.equal(first, webhookFingerprint('integration_fixture', 'abandoned_cart', { ...payload }));
  assert.notEqual(first, webhookFingerprint('integration_fixture', 'abandoned_cart', { ...payload, updated_at: '2026-10-22T10:08:22.000Z' }));
});

test('does not classify Nitro or generic payloads as Shiprocket', () => {
  assert.equal(parseShiprocketAbandonedCart({ eventName: 'view', eventVal: { page: '/' } }), null);
  assert.equal(parseShiprocketAbandonedCart({ type: 'event', event: 'checkout', properties: {} }), null);
});
