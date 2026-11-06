import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTriggerNode } from '../../journey-engine/trigger-config';
import { recoverySuffix } from '../../journey-engine/checkout';

test('unified abandoned-checkout trigger survives save/load and preserves filters', () => {
  const node: any = { id: 'trigger', type: 'trigger', subtype: 'manual_entry', data: { triggerType: 'manual_entry', triggerConfig: { targetSegment: { rules: [{ ruleType: 'user_behavior', eventName: 'custom:abandoned_cart', conditions: [{ property: 'total_price', operator: 'greater_than', value: 100 }] }] } } } };
  const normalized = normalizeTriggerNode(node) as any;
  assert.equal(normalized.data.webhookEvent, 'custom:abandoned_cart');
  assert.equal(normalized.subtype, 'custom:abandoned_cart');
  assert.equal(normalized.trigger.type, 'webhook');
  assert.equal(normalized.trigger.webhookEvent, 'custom:abandoned_cart');
  assert.deepEqual(normalizeTriggerNode(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.equal(normalized.data.conditions[0].field, 'total_price');
});

test('recovery links must match the approved template domain and path', () => {
  assert.equal(recoverySuffix('https://mymaatram.com/checkouts/abc', 'https://mymaatram.com/{{1}}'), 'checkouts/abc');
  assert.throws(() => recoverySuffix('https://checkout.other.com/abc', 'https://mymaatram.com/{{1}}'));
  assert.throws(() => recoverySuffix('', 'https://mymaatram.com/{{1}}'));
  assert.throws(() => recoverySuffix('https://mymaatram.com.evil.test/abc', 'https://mymaatram.com/{{1}}'));
});

test('checkout entries deduplicate atomically, wait 30 minutes, respect pause and never revive cancelled entries', async () => {
  const { prisma } = await import('../../prisma');
  const originals = Object.fromEntries(['journeyDoc', 'journeyEntryClaim', 'journeyEnrollmentDoc', 'journeyScheduleDoc', 'journeyActivityDoc', '$transaction'].map(k => [k, (prisma as any)[k]]));
  const entries = new Map<string, any>(); const schedules = new Map<string, any>(); const claims = new Map<string, any>(); const activity: any[] = [];
  const journey: any = { id: 'j1', storeId: 's1', name: 'Test', status: 'ACTIVE', settings: { testMode: true, testPhoneNumbers: ['917827718504'] }, nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'd', type: 'delay', data: { duration: 30, unit: 'minutes' } }], edges: [{ id: 'edge', source: 't', target: 'd' }] };
  const json = (v: any) => JSON.parse(JSON.stringify(v));
  Object.assign(prisma, {
    journeyDoc: { findFirst: async ({ where }: any) => where.storeId === journey.storeId && journey.status === 'ACTIVE' ? { data: journey, storeId: journey.storeId } : null, findUnique: async () => ({ data: journey, storeId: journey.storeId, status: journey.status }) },
    journeyEntryClaim: { create: async ({ data }: any) => { const key = data.storeId + data.journeyId + data.checkoutKey; if (claims.has(key)) throw { code: 'P2002' }; claims.set(key, data); }, findMany: async ({ where }: any) => [...claims.values()].filter(c => c.storeId === where.storeId && where.checkoutKey.in.includes(c.checkoutKey)) },
    journeyEnrollmentDoc: { create: async ({ data }: any) => { entries.set(data.id, json(data)); }, findUnique: async ({ where }: any) => entries.get(where.id), update: async ({ where, data }: any) => Object.assign(entries.get(where.id), json(data)), updateMany: async ({ where, data }: any) => { const e = entries.get(where.id); if (!e || ['exited', 'completed'].includes(e.status)) return { count: 0 }; Object.assign(e, json(data)); return { count: 1 }; } },
    journeyScheduleDoc: { upsert: async ({ create }: any) => { schedules.set(create.id, create); }, findUnique: async ({ where }: any) => schedules.get(where.id), findMany: async ({ where }: any = {}) => [...schedules.values()].filter(s => (!where?.status || s.status === where.status) && (!where?.resumeAt || s.resumeAt <= where.resumeAt.lte)), update: async ({ where, data }: any) => Object.assign(schedules.get(where.id), data), updateMany: async ({ where, data }: any) => { const matches = [...schedules.values()].filter(s => (!where.id || s.id === where.id) && (!where.enrollmentId || s.enrollmentId === where.enrollmentId) && s.status === where.status); matches.forEach(s => Object.assign(s, data)); return { count: matches.length }; } },
    journeyActivityDoc: { create: async ({ data }: any) => activity.push(data), findMany: async () => [] },
    $transaction: async (fn: any) => fn(prisma),
  });
  try {
    const { startJourneyExecution, processScheduledExecutions } = await import('../../journey-engine/executor');
    const { cancelPurchasedCheckouts } = await import('../../journey-engine/checkout');
    const customer = { id: 'contact', phone: '917827718504' };
    const start = Date.now();
    await Promise.all([1, 2].map(() => startJourneyExecution(journey, customer, journey.nodes[0], { cart_token: 'checkout1' })));
    assert.equal(entries.size, 1); assert.equal(schedules.size, 1);
    const schedule = [...schedules.values()][0];
    assert.ok(schedule.resumeAt.getTime() - start >= 30 * 60_000);
    assert.ok(schedule.resumeAt.getTime() - start < 30 * 60_000 + 5000);
    assert.equal((await processScheduledExecutions(new Date().toISOString())).processed, 0);
    const future = new Date(Date.now() + 31 * 60_000).toISOString();
    journey.status = 'PAUSED';
    assert.equal((await processScheduledExecutions(future)).processed, 0);
    assert.equal(schedule.status, 'pending');
    journey.status = 'ACTIVE';
    const results = await Promise.all([processScheduledExecutions(future), processScheduledExecutions(future)]);
    assert.equal(results.reduce((n, r) => n + r.processed, 0), 1);
    await startJourneyExecution(journey, customer, journey.nodes[0], { cart_token: 'checkout2' });
    await cancelPurchasedCheckouts('foreign', { cart_token: 'checkout2', id: 'o1' });
    assert.equal([...entries.values()].filter(e => e.status === 'waiting').length, 1);
    await cancelPurchasedCheckouts('s1', { cart_token: 'checkout2', id: 'o1' });
    assert.equal([...entries.values()].filter(e => e.status === 'waiting').length, 0);
    assert.equal((await processScheduledExecutions(future)).processed, 0);
    assert.ok(activity.some(a => a.data.eventType === 'journey_cancelled'));
    await startJourneyExecution(journey, { id: 'someone', phone: '919999999999' }, journey.nodes[0], { cart_token: 'checkout3' });
    assert.equal(entries.size, 2);
    journey.settings.testMode = false;
    await startJourneyExecution(journey, { id: 'someone-else', phone: '918888888888' }, journey.nodes[0], { cart_token: 'checkout4' });
    assert.equal(entries.size, 2, 'an allow-list remains restrictive even if a stale client clears testMode');
  } finally { Object.assign(prisma, originals); }
});

test('event matching requires a verified store and queries only that store', async () => {
  const { prisma } = await import('../../prisma');
  const original = prisma.journeyDoc.findMany;
  prisma.journeyDoc.findMany = (async ({ where }: any) => { assert.equal(where.storeId, 'store-1'); return []; }) as any;
  try {
    const { matchAndExecuteJourneys } = await import('../../journey-engine/trigger-matcher');
    await assert.rejects(matchAndExecuteJourneys('custom:event', { payload: { storeId: 'forged' } }));
    await matchAndExecuteJourneys('custom:event', { storeId: 'store-1', payload: { storeId: 'forged' } });
  } finally { prisma.journeyDoc.findMany = original; }
});

test('purchase lookup uses tenant credentials, handles missing tokens conservatively, and fails closed', async () => {
  const { prisma } = await import('../../prisma');
  const originalStore = prisma.store.findUniqueOrThrow;
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = '0'.repeat(64);
  let response: any = { data: { orders: { nodes: [] } } };
  let filter = '';
  prisma.store.findUniqueOrThrow = (async ({ where }: any) => { assert.equal(where.id, 's1'); return { shopifyDomain: 'tenant-one.myshopify.com', accessToken: 'tenant-token' }; }) as any;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://tenant-one.myshopify.com/'));
    assert.equal(new Headers(options?.headers).get('X-Shopify-Access-Token'), 'tenant-token');
    filter = JSON.parse(String(options?.body)).variables.query;
    return new Response(JSON.stringify(response));
  };
  try {
    const { checkoutPurchased } = await import('../../journey-engine/checkout');
    assert.equal(await checkoutPurchased('s1', { cart_token: 'token?key=private' }), false);
    assert.ok(!filter.includes('private'));
    response = { data: { orders: { nodes: [{ cartToken: 'token' }] } } };
    assert.equal(await checkoutPurchased('s1', { cart_token: 'token' }), true);
    response = { data: { orders: { nodes: [{ email: 'sahil@example.test', createdAt: '2026-11-05T10:05:00Z' }] } } };
    assert.equal(await checkoutPurchased('s1', { cart_id: 'shiprocket-id', email: 'sahil@example.test', created_at: '2026-11-05T10:00:00Z' }), true);
    assert.ok(filter.includes('email:'));
    await assert.rejects(checkoutPurchased('s1', { cart_id: 'missing-verification-data' }));
    response = { errors: [{ message: 'Access denied' }] };
    await assert.rejects(checkoutPurchased('s1', { cart_token: 'token' }));
  } finally {
    prisma.store.findUniqueOrThrow = originalStore; globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = originalKey;
  }
});

test('live WhatsApp journeys resolve only store-scoped opted-in contacts and recheck consent', async () => {
  const { prisma } = await import('../../prisma');
  const original = prisma.contact.findFirst;
  let optedIn = true;
  prisma.contact.findFirst = (async ({ where }: any) => {
    assert.equal(where.storeId, 'store-1');
    assert.equal(where.optInStatus, 'OPTED_IN');
    return optedIn ? { id: 'contact-1', phone: '917827718504', email: 'sahil@example.test', name: 'Sahil' } : null;
  }) as any;
  try {
    const { resolveOptedInWhatsAppRecipient } = await import('../../journey-engine/consent');
    const recipient = await resolveOptedInWhatsAppRecipient('store-1', { id: 'shopify-1', phone: '+91 78277 18504' });
    assert.equal(recipient?.id, 'contact-1');
    assert.equal(recipient?.phone, '917827718504');
    optedIn = false;
    assert.equal(await resolveOptedInWhatsAppRecipient('store-1', { id: 'shopify-1', phone: '+91 78277 18504' }), null);
  } finally {
    prisma.contact.findFirst = original;
  }
});
