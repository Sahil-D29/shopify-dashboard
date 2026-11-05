import test from 'node:test';
import assert from 'node:assert/strict';

test('one-person campaigns count only accepted sends; missing phones, empty audiences and provider rejections fail visibly', async () => {
  const original = (globalThis as any).prisma;
  const originalFetch = globalThis.fetch;
  let contacts: any[] = [];
  let rejectProvider = false;
  let earlyFailure = false;
  let logs: any[] = [];
  let updates: any[] = [];
  const campaign = { id: 'c1', storeId: 's1', type: 'ONE_TIME', status: 'RUNNING', segmentIds: ['seg1'], segmentId: 'seg1', sendingSpeed: 'FAST', messageTemplate: {}, whatsappConfig: { templateName: 'test', templateLanguage: 'en', variableMappings: [{ variable: '1', dataSource: 'customer', property: 'firstName' }] } };
  (globalThis as any).prisma = {
    $transaction: async (fn: any) => fn((globalThis as any).prisma),
    $queryRaw: async () => [],
    whatsAppReceiptDoc: { findMany: async () => [] },
    campaignQueueItem: { findFirst: async (query: any) => { assert.equal(query.where.campaignId, 'c1'); return { id: 'q1', campaign, store: {}, retryCount: 0 }; }, updateMany: async () => ({ count: 1 }), update: async () => ({}) },
    campaign: { update: async (query: any) => { updates.push(query.data); return {}; } },
    segment: { findMany: async (query: any) => { assert.equal(query.where.storeId, 's1'); return [{ id: 'seg1', filters: { conditionGroups: [] } }]; } },
    contact: { findMany: async (query: any) => { assert.equal(query.where.storeId, 's1'); return contacts; } },
    campaignLog: { findMany: async () => logs, create: async (query: any) => { logs.push(earlyFailure && query.data.whatsappMessageId ? { ...query.data, status: 'FAILED' } : query.data); return {}; } },
    whatsAppConfig: { findUnique: async () => ({ isConfigured: true, phoneNumberId: 'p1', businessAccountId: 'w1', accessToken: 'fake-token' }) },
    usageMetric: { upsert: async () => ({}) }, errorLog: { create: async () => ({}) },
  };
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('message_templates')) return new Response(JSON.stringify({ data: [{ id: '1', name: 'test', language: 'en', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hello {{1}}' }] }] }));
    if (!String(url).includes('graph.facebook.com')) return new Response(JSON.stringify({ customers: [] }));
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.template.components[0].parameters[0].text, 'Sahil');
    return new Response(JSON.stringify(rejectProvider ? { error: { code: 131008, message: 'Missing parameter', fbtrace_id: 'provider-trace' } } : { messages: [{ id: 'wamid.accepted' }] }), { status: rejectProvider ? 400 : 200 });
  };
  try {
    const { runCampaignWorkerStep } = await import('../../../jobs/campaign.worker');
    contacts = [{ id: 'contact1', name: 'Sahil', phone: '9876543210', tags: [] }];
    await runCampaignWorkerStep('c1');
    assert.equal(logs[0].status, 'SUCCESS');
    assert.equal(updates[0].totalSent, 1);
    assert.equal(updates[0].totalFailed, 0);
    logs = []; updates = []; earlyFailure = true;
    await runCampaignWorkerStep('c1');
    assert.equal(updates[0].status, 'FAILED');
    assert.equal(updates[0].totalSent, 1);
    assert.equal(updates[0].totalFailed, 1);
    earlyFailure = false;
    logs = []; updates = []; rejectProvider = true;
    await runCampaignWorkerStep('c1');
    assert.equal(logs[0].status, 'FAILED');
    assert.equal(logs[0].metadata.issues[0].code, '131008');
    assert.equal(updates[0].totalSent, 0);
    assert.equal(updates[0].status, 'FAILED');
    logs = []; updates = []; contacts = [{ id: 'contact1', name: 'Sahil', tags: [] }];
    await runCampaignWorkerStep('c1');
    assert.equal(logs[0].metadata.issues[0].field, 'phone');
    assert.equal(updates[0].totalSent, 0);
    logs = []; updates = []; contacts = [];
    await runCampaignWorkerStep('c1');
    assert.equal(logs[0].metadata.issues[0].code, 'EMPTY_AUDIENCE');
    assert.equal(updates[0].status, 'FAILED');
  } finally { globalThis.fetch = originalFetch; (globalThis as any).prisma = original; }
});
