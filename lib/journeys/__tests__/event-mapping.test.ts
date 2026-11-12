import test from 'node:test';
import assert from 'node:assert/strict';

import { getJourneyEventSchema } from '../event-schema';
import {
  mappingTokenPaths,
  previewEventMapping,
  resolveEventMapping,
  validateEventUrlMapping,
} from '../event-mapping';
import type { TemplateComponentMapping } from '@/lib/types/whatsapp-config';

const base: TemplateComponentMapping = {
  parameterId: 'button.0',
  component: 'BUTTON',
  componentIndex: 0,
  dataSource: 'event',
  property: 'checkout_url',
  mode: 'field',
  approvedPrefix: 'https://mymaatram.com/',
};

test('field mappings resolve nested and indexed live event values', () => {
  assert.equal(resolveEventMapping(base, { checkout_url: 'https://mymaatram.com/?resume=one' }), 'https://mymaatram.com/?resume=one');
  assert.equal(resolveEventMapping({ ...base, property: 'item_name_list.0' }, { item_name_list: ['Mala'] }), 'Mala');
});

test('URL builder combines static text with registered event tokens', () => {
  const mapping = { ...base, mode: 'expression' as const, expression: '?cart={{cart_token}}&email={{email}}' };
  assert.deepEqual(mappingTokenPaths(mapping), ['cart_token', 'email']);
  assert.equal(resolveEventMapping(mapping, { cart_token: 'abc', email: 'sahil@example.com' }), '?cart=abc&email=sahil@example.com');
  assert.equal(validateEventUrlMapping(mapping, 'https://mymaatram.com/', getJourneyEventSchema('custom:abandoned_cart')).length, 0);
});

test('URL mapping rejects static, unregistered and cross-origin values', () => {
  const schema = getJourneyEventSchema('custom:abandoned_cart');
  assert.ok(validateEventUrlMapping({ ...base, mode: 'expression', expression: 'same-for-everyone' }, base.approvedPrefix!, schema).length);
  assert.ok(validateEventUrlMapping({ ...base, property: 'unknown' }, base.approvedPrefix!, schema).some(error => error.includes('not registered')));
  assert.ok(validateEventUrlMapping({ ...base, mode: 'expression', expression: 'https://evil.example/{{cart_token}}' }, base.approvedPrefix!, schema).length);
});

test('schema preview uses clearly defined sample event data', () => {
  assert.equal(previewEventMapping(base, getJourneyEventSchema('custom:abandoned_cart')), 'https://mymaatram.com/?cart-resume-id=sample&type=report');
});
