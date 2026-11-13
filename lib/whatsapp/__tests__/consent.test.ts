import test from 'node:test';
import assert from 'node:assert/strict';

test('explicit storefront consent records evidence and opts the contact in', async () => {
  const original = (globalThis as any).prisma;
  const audits: any[] = [];
  const updates: any[] = [];
  const contact = {
    id: 'contact-1',
    storeId: 'store-1',
    phone: '919876543210',
    email: 'buyer@example.com',
    optInStatus: 'PENDING',
    optInAt: null,
    optOutAt: null,
    metadata: {},
  };
  const fake: any = {
    contact: {
      findFirst: async () => contact,
      update: async ({ data }: any) => {
        updates.push(data);
        return { ...contact, ...data };
      },
      create: async ({ data }: any) => ({ id: 'created', ...data }),
    },
    whatsAppConsentEvent: {
      create: async ({ data }: any) => { audits.push(data); return data; },
    },
    journeyDoc: { findMany: async () => [] },
    $transaction: async (callback: any) => callback(fake),
  };
  (globalThis as any).prisma = fake;
  try {
    const { recordWhatsAppConsent } = await import('../../journey-engine/consent');
    const capturedAt = new Date('2026-11-13T10:00:00.000Z');
    const result = await recordWhatsAppConsent({
      storeId: 'store-1',
      contactId: contact.id,
      phone: '+91 98765 43210',
      email: contact.email,
      granted: true,
      source: 'shopify_cart_app_block',
      capturedAt,
      wordingVersion: 'cart-consent-v1',
      evidence: { cartToken: 'cart-1' },
    });
    assert.equal(result.applied, true);
    assert.equal(updates[0].optInStatus, 'OPTED_IN');
    assert.equal(updates[0].optInAt.toISOString(), capturedAt.toISOString());
    assert.equal((updates[0].metadata as any).whatsappConsent.source, 'shopify_cart_app_block');
    assert.equal(audits[0].status, 'GRANTED');
    assert.equal(audits[0].wordingVersion, 'cart-consent-v1');
  } finally {
    (globalThis as any).prisma = original;
  }
});
