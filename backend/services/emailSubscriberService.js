// backend/services/emailSubscriberService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const subscribersFile = path.join(process.cwd(), 'backend', 'data', 'email-subscribers.json');
const suppressionFile = path.join(process.cwd(), 'backend', 'data', 'email-suppression.json');

// --- Subscribers ---

export async function loadSubscribers() {
  const data = await readFileSafe(subscribersFile, { default: { subscribers: [] } });
  return data.subscribers || [];
}

async function saveSubscribers(subscribers) {
  await writeFileSafe(subscribersFile, { subscribers });
}

export async function getSubscriberByEmail(email, storeId) {
  const subscribers = await loadSubscribers();
  return subscribers.find(s => s.email === email && s.storeId === storeId);
}

export async function getSubscribersByStore(storeId, { status, page = 1, limit = 50 } = {}) {
  let subscribers = await loadSubscribers();
  subscribers = subscribers.filter(s => s.storeId === storeId);
  if (status) {
    subscribers = subscribers.filter(s => s.status === status);
  }
  const total = subscribers.length;
  const start = (page - 1) * limit;
  return {
    subscribers: subscribers.slice(start, start + limit),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function addSubscriber({ email, storeId, firstName, lastName, source, tags }) {
  const subscribers = await loadSubscribers();
  const existing = subscribers.find(s => s.email === email && s.storeId === storeId);

  if (existing) {
    if (existing.status === 'unsubscribed') {
      existing.status = 'subscribed';
      existing.subscribedAt = new Date().toISOString();
      existing.unsubscribedAt = null;
      await saveSubscribers(subscribers);
      return existing;
    }
    return existing;
  }

  const subscriber = {
    id: `sub_${uuidv4()}`,
    email,
    storeId,
    firstName: firstName || '',
    lastName: lastName || '',
    status: 'subscribed',
    source: source || 'manual',
    tags: tags || [],
    subscribedAt: new Date().toISOString(),
    unsubscribedAt: null,
    bouncedAt: null,
    complainedAt: null,
    createdAt: new Date().toISOString(),
  };

  subscribers.push(subscriber);
  await saveSubscribers(subscribers);
  return subscriber;
}

export async function unsubscribe(email, storeId) {
  const subscribers = await loadSubscribers();
  const sub = subscribers.find(s => s.email === email && s.storeId === storeId);
  if (!sub) return null;

  sub.status = 'unsubscribed';
  sub.unsubscribedAt = new Date().toISOString();
  await saveSubscribers(subscribers);

  await logActivity({
    type: 'email_unsubscribed',
    actorId: 'subscriber',
    storeId,
    email,
  });

  return sub;
}

export async function markBounced(email, storeId, bounceType) {
  const subscribers = await loadSubscribers();
  const sub = subscribers.find(s => s.email === email && s.storeId === storeId);
  if (sub) {
    sub.status = bounceType === 'Permanent' ? 'bounced' : sub.status;
    sub.bouncedAt = new Date().toISOString();
    await saveSubscribers(subscribers);
  }

  if (bounceType === 'Permanent') {
    await addToSuppression(email, storeId, 'hard_bounce');
  }
}

export async function markComplained(email, storeId) {
  const subscribers = await loadSubscribers();
  const sub = subscribers.find(s => s.email === email && s.storeId === storeId);
  if (sub) {
    sub.status = 'complained';
    sub.complainedAt = new Date().toISOString();
    await saveSubscribers(subscribers);
  }

  await addToSuppression(email, storeId, 'complaint');
}

export async function syncFromShopifyCustomers(customers, storeId) {
  const subscribers = await loadSubscribers();
  let added = 0;

  for (const customer of customers) {
    if (!customer.email) continue;
    const exists = subscribers.find(s => s.email === customer.email && s.storeId === storeId);
    if (exists) continue;

    const suppressed = await isEmailSuppressed(customer.email, storeId);
    if (suppressed) continue;

    subscribers.push({
      id: `sub_${uuidv4()}`,
      email: customer.email,
      storeId,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      status: 'subscribed',
      source: 'shopify_sync',
      tags: [],
      subscribedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    added++;
  }

  await saveSubscribers(subscribers);
  return { added, total: subscribers.filter(s => s.storeId === storeId).length };
}

export async function getSubscribableEmails(customers, storeId) {
  const subscribers = await loadSubscribers();
  const suppression = await loadSuppression(storeId);

  const suppressedEmails = new Set(suppression.map(s => s.email));
  const unsubscribedEmails = new Set(
    subscribers.filter(s => s.storeId === storeId && s.status !== 'subscribed').map(s => s.email)
  );

  return customers.filter(c => {
    if (!c.email) return false;
    if (suppressedEmails.has(c.email)) return false;
    if (unsubscribedEmails.has(c.email)) return false;
    return true;
  });
}

// --- Suppression List ---

async function loadSuppressionAll() {
  const data = await readFileSafe(suppressionFile, { default: { entries: [] } });
  return data.entries || [];
}

async function saveSuppression(entries) {
  await writeFileSafe(suppressionFile, { entries });
}

export async function loadSuppression(storeId) {
  const entries = await loadSuppressionAll();
  return storeId ? entries.filter(e => e.storeId === storeId || e.storeId === 'global') : entries;
}

export async function addToSuppression(email, storeId, reason) {
  const entries = await loadSuppressionAll();
  const exists = entries.find(e => e.email === email && (e.storeId === storeId || e.storeId === 'global'));
  if (exists) return exists;

  const entry = {
    id: `sup_${uuidv4()}`,
    email,
    storeId,
    reason,
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  await saveSuppression(entries);
  return entry;
}

export async function removeFromSuppression(email, storeId) {
  const entries = await loadSuppressionAll();
  const filtered = entries.filter(e => !(e.email === email && e.storeId === storeId));
  await saveSuppression(filtered);
}

export async function isEmailSuppressed(email, storeId) {
  const entries = await loadSuppressionAll();
  return entries.some(e => e.email === email && (e.storeId === storeId || e.storeId === 'global'));
}
