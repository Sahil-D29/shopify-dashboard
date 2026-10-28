import test from 'node:test';
import assert from 'node:assert/strict';

import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';
import {
  buildMetaPayload,
  formatTemplateRejectionReason,
  META_TEMPLATE_FIELDS,
  validateDynamicUrlButton,
} from '../template-submission';

function makeTemplate(button: NonNullable<WhatsAppTemplate['buttons']>[number]): WhatsAppTemplate {
  return {
    id: 'draft-1',
    name: 'cart_reminder',
    category: 'MARKETING',
    language: 'en',
    status: 'DRAFT',
    content: 'Your cart is waiting for you.',
    body: 'Your cart is waiting for you.',
    variables: [],
    sampleValues: {},
    hasMediaHeader: false,
    hasButtons: true,
    buttons: [button],
  };
}

function getFirstMetaButton(template: WhatsAppTemplate) {
  const payload = buildMetaPayload(template);
  const component = payload.components.find(item => item.type === 'BUTTONS');
  assert.ok(component && component.type === 'BUTTONS');
  return component.buttons[0];
}

test('static URL buttons remain valid without an example', () => {
  const button = getFirstMetaButton(
    makeTemplate({ id: 'buy', type: 'URL', text: 'Buy now', url: 'https://www.dorza.io/' }),
  );

  assert.deepEqual(button, {
    type: 'URL',
    text: 'Buy now',
    url: 'https://www.dorza.io/',
  });
});

test('dynamic URL buttons include the full review example required by Meta', () => {
  const button = getFirstMetaButton(
    makeTemplate({
      id: 'cart',
      type: 'URL',
      text: 'Shop Now',
      url: 'https://mymaatram.com/{{1}}',
      urlExample: 'https://mymaatram.com/cart',
    }),
  );

  assert.deepEqual(button, {
    type: 'URL',
    text: 'Shop Now',
    url: 'https://mymaatram.com/{{1}}',
    example: ['https://mymaatram.com/cart'],
  });
});

test('dynamic URL validation rejects missing, non-HTTPS, and mismatched examples', () => {
  const url = 'https://mymaatram.com/{{1}}';

  assert.match(validateDynamicUrlButton(url, undefined).error ?? '', /example URL is required/);
  assert.match(validateDynamicUrlButton(url, 'http://mymaatram.com/cart').error ?? '', /valid HTTPS URL/);
  assert.match(validateDynamicUrlButton(url, 'https://example.com/cart').error ?? '', /must start with/);
  assert.equal(validateDynamicUrlButton(url, 'https://mymaatram.com/cart').error, undefined);
});

test('dynamic URL validation rejects misplaced, repeated, and non-numeric placeholders', () => {
  assert.match(
    validateDynamicUrlButton('https://mymaatram.com/{{1}}/cart', 'https://mymaatram.com/example/cart').error ?? '',
    /exactly one \{\{1\}\} placeholder at the end/,
  );
  assert.match(
    validateDynamicUrlButton('https://mymaatram.com/{{1}}/{{1}}', 'https://mymaatram.com/a/b').error ?? '',
    /exactly one \{\{1\}\} placeholder at the end/,
  );
  assert.match(
    validateDynamicUrlButton('https://mymaatram.com/{{cart}}', 'https://mymaatram.com/cart').error ?? '',
    /exactly one \{\{1\}\} placeholder at the end/,
  );
});

test('Meta template reads request rejection reasons and format them for the UI', () => {
  assert.match(META_TEMPLATE_FIELDS, /rejected_reason/);
  assert.equal(
    formatTemplateRejectionReason('INVALID_FORMAT'),
    'Invalid template format. Check variable placement and required examples for dynamic URLs.',
  );
});
