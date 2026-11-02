import test from 'node:test';
import assert from 'node:assert/strict';

test('a journey recipient without a phone fails the action without completing it or retrying a configuration error', async () => {
  const original = (globalThis as any).prisma;
  const activity: any[] = [];
  const enrollment: any = { id: 'e1', journeyId: 'j1', customerId: 'customer1', status: 'active', completedNodes: [], enteredAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), context: {}, metadata: {} };
  (globalThis as any).prisma = {
    journeyEnrollmentDoc: { upsert: async () => ({}) },
    journeyActivityDoc: { create: async ({ data }: any) => { activity.push(data.data); } },
    journeyScheduleDoc: { findMany: async () => [] },
  };
  try {
    const { executeNode } = await import('../../journey-engine/executor');
    const node: any = { id: 'wa1', type: 'action', subtype: 'send_whatsapp', data: { meta: { whatsappActionConfig: { templateName: 'test' } } } };
    await executeNode({ id: 'j1', storeId: 's1', nodes: [node], edges: [] } as any, enrollment, node);
    assert.equal(enrollment.status, 'failed');
    assert.deepEqual(enrollment.completedNodes, []);
    const error = activity.find(item => item.eventType === 'node_error');
    assert.equal(error.data.issues[0].code, 'MISSING_PHONE');
    assert.equal(error.data.issues[0].nodeId, 'wa1');
    assert.ok(!activity.some(item => item.eventType === 'retry_scheduled'));
  } finally { (globalThis as any).prisma = original; }
});
