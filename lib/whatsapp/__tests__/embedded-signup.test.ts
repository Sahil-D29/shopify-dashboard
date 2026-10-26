import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmbeddedSignupOptions, parseEmbeddedSignupMessage } from '../embedded-signup-client';
import { extractWabaIdsFromTokenDebug } from '../embedded-signup-data';

test('parses Meta Embedded Signup FINISH data', () => {
  const result = parseEmbeddedSignupMessage('https://www.facebook.com', JSON.stringify({
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: { waba_id: 'waba-123', phone_number_id: 'phone-456' },
  }));

  assert.deepEqual(result, {
    event: 'FINISH',
    wabaId: 'waba-123',
    phoneNumberId: 'phone-456',
    errorMessage: undefined,
  });
});

test('parses the existing WhatsApp Business App completion event', () => {
  const result = parseEmbeddedSignupMessage('https://www.facebook.com', JSON.stringify({
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    version: 3,
    data: { waba_id: 'waba-existing' },
  }));

  assert.deepEqual(result, {
    event: 'FINISH',
    wabaId: 'waba-existing',
    phoneNumberId: undefined,
    errorMessage: undefined,
  });
});

test('parses nested v4 signup result identifiers', () => {
  const result = parseEmbeddedSignupMessage('https://business.facebook.com', {
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: {
      result: {
        whatsapp_business_account_id: 'waba-v4',
        phone_number_id: 'phone-v4',
      },
    },
  });

  assert.equal(result?.wabaId, 'waba-v4');
  assert.equal(result?.phoneNumberId, 'phone-v4');
});

test('rejects spoofed Embedded Signup messages', () => {
  const result = parseEmbeddedSignupMessage('https://facebook.com.evil.example', {
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: { waba_id: 'waba-123', phone_number_id: 'phone-456' },
  });
  assert.equal(result, null);
});

test('extracts and deduplicates WABA ids from granular scopes', () => {
  const ids = extractWabaIdsFromTokenDebug({
    data: {
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['waba-1', 'waba-2'] },
        { scope: 'whatsapp_business_messaging', target_ids: ['waba-1'] },
        { scope: 'business_management', target_ids: ['business-1'] },
      ],
    },
  });

  assert.deepEqual(ids, ['waba-1', 'waba-2']);
});

test('uses the Embedded Signup v4 launch shape', () => {
  const options = buildEmbeddedSignupOptions('config-v4');

  assert.deepEqual(options, {
    config_id: 'config-v4',
    auth_type: 'rerequest',
    response_type: 'code',
    override_default_response_type: true,
    extras: { setup: {} },
  });
  const extras = options.extras as Record<string, unknown>;
  assert.equal('sessionInfoVersion' in extras, false);
  assert.equal('featureType' in extras, false);
});
