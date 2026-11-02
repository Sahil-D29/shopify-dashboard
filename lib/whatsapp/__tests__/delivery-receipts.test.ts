import test from 'node:test';
import assert from 'node:assert/strict';

test('receipts update campaign counters once, handle read-before-delivered and retain provider failure details', async () => {
  const original = (globalThis as any).prisma;
  let log: any = { id: 'l1', campaignId: 'c1', status: 'SUCCESS', deliveredAt: null, readAt: null, metadata: {} };
  const totals = { delivered: 0, read: 0, failed: 0 };
  const tx = {
    message: { findMany: async () => [] },
    campaignLog: {
      findMany: async (query: any) => { assert.equal(query.where.campaign.storeId, 's1'); return [{ ...log }]; },
      updateMany: async ({ where, data }: any) => { if (where.status !== log.status) return { count: 0 }; Object.assign(log, data); return { count: 1 }; },
      count: async () => 0,
    },
    campaign: { update: async ({ data }: any) => { totals.delivered += data.totalDelivered?.increment ?? 0; totals.read += data.totalOpened?.increment ?? 0; totals.failed += data.totalFailed?.increment ?? 0; }, updateMany: async () => ({ count: 1 }) },
    journeyActivityDoc: { findFirst: async () => null },
  };
  (globalThis as any).prisma = { ...tx, whatsAppConfig: { findFirst: async (query: any) => query.where.phoneNumberId === 'p1' ? { storeId: 's1' } : null }, $transaction: async (fn: any) => fn(tx) };
  try {
    const { applyDeliveryReceipt } = await import('../delivery-receipts');
    const receipt = { id: 'wamid1', status: 'read', timestamp: String(Math.floor(Date.now() / 1000)) };
    await applyDeliveryReceipt(receipt, 'p1');
    await applyDeliveryReceipt(receipt, 'p1');
    await applyDeliveryReceipt({ ...receipt, status: 'delivered' }, 'p1');
    assert.deepEqual(totals, { delivered: 1, read: 1, failed: 0 });
    assert.equal(log.status, 'READ');
    log = { id: 'l2', campaignId: 'c1', status: 'SUCCESS', deliveredAt: null, readAt: null, metadata: { templateName: 'test' } };
    const failure = { ...receipt, status: 'failed', errors: [{ code: 131026, error_data: { details: 'Recipient unavailable' } }] };
    await applyDeliveryReceipt(failure, 'p1');
    await applyDeliveryReceipt(failure, 'p1');
    assert.equal(totals.failed, 1);
    assert.equal(log.metadata.issues[0].code, '131026');
    assert.equal(log.metadata.issues[0].details, 'Recipient unavailable');
    assert.equal(log.metadata.templateName, 'test');
    await applyDeliveryReceipt(receipt, 'foreign-phone');
    assert.equal(totals.read, 1);
  } finally { (globalThis as any).prisma = original; }
});
