import test from 'node:test';
import assert from 'node:assert/strict';
import { SendValidationError } from '../issues';

const template = { id: '123', name: 'sahil_test', language: 'en_US', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hi {{1}}' }] };

test('live template sending uses tenant credentials, validates parameters, and preserves Meta errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalPrisma = (globalThis as any).prisma;
  const queries: any[] = [];
  (globalThis as any).prisma = { whatsAppConfig: { findUnique: async (query: any) => {
    queries.push(query);
    return query.where.storeId === 'store-sahil' ? { isConfigured: true, phoneNumberId: 'phone123', businessAccountId: 'waba123', accessToken: 'fake-test-token' } : null;
  } } };
  const requests: Array<{ url: string; body?: any; auth?: string }> = [];
  let providerFails = false;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: (init?.headers as any)?.Authorization });
    return new Response(JSON.stringify(String(url).includes('message_templates') ? { data: [template] }
      : providerFails ? { error: { code: 131008, fbtrace_id: 'trace-test', error_data: { details: 'header: image required' } } } : { messages: [{ id: 'wamid.real-provider-id' }] }), { status: providerFails && !String(url).includes('message_templates') ? 400 : 200 });
  };
  try {
    const { sendTemplate, resolveTemplate } = await import('../template-send');
    const input = { templateName: 'sahil_test', templateLanguage: 'en_US', variables: { '1': 'Sahil' } };
    const result = await sendTemplate('store-sahil', '9876543210', input);
    assert.equal(result.messageId, 'wamid.real-provider-id');
    assert.equal(requests.at(-1)?.body.to, '919876543210');
    assert.equal(requests.at(-1)?.body.type, 'template');
    assert.equal(requests.at(-1)?.body.template.components[0].parameters[0].text, 'Sahil');
    assert.equal(requests.at(-1)?.auth, 'Bearer fake-test-token');
    assert.ok(requests[0].url.includes('/waba123/message_templates'));
    assert.ok(queries.every(q => q.where.storeId === 'store-sahil'));
    let sends = requests.filter(r => r.body).length;
    await assert.rejects(sendTemplate('store-sahil', '9876543210', { ...input, variables: {} }), SendValidationError);
    assert.equal(requests.filter(r => r.body).length, sends);
    await assert.rejects(resolveTemplate('other-store', input), (error: any) => error.issues[0].code === 'CONFIG_NOT_SET');
    await assert.rejects(resolveTemplate('store-sahil', { ...input, templateLanguage: 'hi' }), (error: any) => error.issues[0].code === 'TEMPLATE_NOT_FOUND');
    await assert.rejects(sendTemplate('store-sahil', '', input), (error: any) => error.issues[0].field === 'phone');
    providerFails = true;
    await assert.rejects(sendTemplate('store-sahil', '9876543210', input), (error: any) => error.issues[0].referenceId === 'trace-test' && error.issues[0].details === 'header: image required');
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).prisma = originalPrisma;
  }
});
