import test from 'node:test';
import assert from 'node:assert/strict';

test('issue listing scopes every source to the authorized store, paginates failures, and removes fixed blockers', async () => {
  const original = (globalThis as any).prisma;
  const originalFetch = globalThis.fetch;
  let valid = false;
  const calls: any[] = [];
  const campaign = { id: 'c1', storeId: 's1', name: 'Sahil', status: 'DRAFT', updatedAt: new Date(), whatsappConfig: { templateName: 'test', templateLanguage: 'en', variables: {} } };
  const failures = Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, campaignId: 'c1', customerId: 'recipient', error: '(#131008) Required parameter is missing', metadata: {}, createdAt: new Date(Date.now() - i * 1000) }));
  (globalThis as any).prisma = {
    campaign: { findMany: async (query: any) => { calls.push(query); assert.equal(query.where.storeId, 's1'); return query.where.id && query.where.id !== 'c1' ? [] : [campaign]; } },
    journeyDoc: { findMany: async (query: any) => { assert.equal(query.where.storeId, 's1'); return []; } },
    journeyActivityDoc: { findMany: async (query: any) => { assert.deepEqual(query.where.enrollmentId.in, []); return []; }, count: async () => 0 },
    campaignLog: { findMany: async (query: any) => { assert.deepEqual(query.where.campaignId.in, ['c1']); return failures.slice(0, query.take); }, count: async () => 25 },
    whatsAppConfig: { findUnique: async () => ({ isConfigured: true, phoneNumberId: 'p1', businessAccountId: 'w1', accessToken: 'fake-token' }) },
  };
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: '1', name: 'test', language: 'en', status: 'APPROVED', components: [{ type: 'BODY', text: valid ? 'Hello' : 'Hello {{1}}' }] }] }));
  try {
    const { listSendingIssues } = await import('../sending-issues');
    await assert.rejects(listSendingIssues('', new URLSearchParams()), (error: any) => error.status === 401);
    assert.equal(calls.length, 0);
    await assert.rejects(listSendingIssues('s1', new URLSearchParams('kind=campaign&id=foreign')), (error: any) => error.status === 404);
    const first = await listSendingIssues('s1', new URLSearchParams('kind=campaign&id=c1'));
    assert.equal(first.records.length, 20);
    assert.equal(first.total, 25);
    assert.equal(first.blockers[0].issues[0].field, 'body.1');
    const second = await listSendingIssues('s1', new URLSearchParams('kind=campaign&id=c1&page=2'));
    assert.equal(second.records.length, 5);
    assert.equal(second.records[0].id, 'f20');
    valid = true;
    const fixed = await listSendingIssues('s1', new URLSearchParams('kind=campaign&id=c1'));
    assert.equal(fixed.blockers.length, 0);
    assert.equal(fixed.records.length, 20); // Historical failures remain visible.
    assert.equal(fixed.records[0].issues[0].code, '131008');
  } finally { globalThis.fetch = originalFetch; (globalThis as any).prisma = original; }
});
