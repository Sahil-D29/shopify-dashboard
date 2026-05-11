// backend/services/emailAnalyticsService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';

function getShardFile(date) {
  const d = date ? new Date(date) : new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return path.join(process.cwd(), 'backend', 'data', `email-analytics-${ym}.json`);
}

async function loadShard(date) {
  const file = getShardFile(date);
  const data = await readFileSafe(file, { default: { events: [] } });
  return { file, events: data.events || [] };
}

async function saveShard(file, events) {
  await writeFileSafe(file, { events });
}

export async function trackEvent({ campaignId, email, eventType, metadata = {} }) {
  const now = new Date();
  const { file, events } = await loadShard(now);

  events.push({
    id: `evt_${uuidv4()}`,
    campaignId,
    email,
    eventType,
    metadata,
    timestamp: now.toISOString(),
  });

  await saveShard(file, events);
}

export async function trackOpen(campaignId, email) {
  await trackEvent({ campaignId, email, eventType: 'opened' });
}

export async function trackClick(campaignId, email, url, linkIndex) {
  await trackEvent({ campaignId, email, eventType: 'clicked', metadata: { url, linkIndex } });
}

export async function trackBounce(campaignId, email, bounceType, reason) {
  await trackEvent({ campaignId, email, eventType: 'bounced', metadata: { bounceType, reason } });
}

export async function trackUnsubscribe(campaignId, email) {
  await trackEvent({ campaignId, email, eventType: 'unsubscribed' });
}

export async function trackComplaint(campaignId, email) {
  await trackEvent({ campaignId, email, eventType: 'complained' });
}

export async function trackSent(campaignId, email) {
  await trackEvent({ campaignId, email, eventType: 'sent' });
}

export async function trackDelivered(campaignId, email) {
  await trackEvent({ campaignId, email, eventType: 'delivered' });
}

export async function getCampaignMetrics(campaignId) {
  const events = await getEventsForCampaign(campaignId);

  const uniqueOpens = new Set();
  const uniqueClicks = new Set();
  let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, complained = 0;

  for (const evt of events) {
    switch (evt.eventType) {
      case 'sent': sent++; break;
      case 'delivered': delivered++; break;
      case 'opened':
        opened++;
        uniqueOpens.add(evt.email);
        break;
      case 'clicked':
        clicked++;
        uniqueClicks.add(evt.email);
        break;
      case 'bounced': bounced++; break;
      case 'unsubscribed': unsubscribed++; break;
      case 'complained': complained++; break;
    }
  }

  return {
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    unsubscribed,
    complained,
    uniqueOpens: uniqueOpens.size,
    uniqueClicks: uniqueClicks.size,
    openRate: sent > 0 ? ((uniqueOpens.size / sent) * 100).toFixed(2) : '0.00',
    clickRate: sent > 0 ? ((uniqueClicks.size / sent) * 100).toFixed(2) : '0.00',
    bounceRate: sent > 0 ? ((bounced / sent) * 100).toFixed(2) : '0.00',
    unsubscribeRate: sent > 0 ? ((unsubscribed / sent) * 100).toFixed(2) : '0.00',
  };
}

export async function getEventsForCampaign(campaignId) {
  const now = new Date();
  const allEvents = [];

  // Check current month and previous month
  for (let offset = 0; offset <= 2; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    try {
      const { events } = await loadShard(date);
      allEvents.push(...events.filter(e => e.campaignId === campaignId));
    } catch {
      // shard may not exist
    }
  }

  return allEvents;
}

export async function getStoreAnalytics(storeId, { startDate, endDate, campaignIds } = {}) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : now;

  const allEvents = [];
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  let current = new Date(startMonth);
  while (current <= endMonth) {
    try {
      const { events } = await loadShard(current);
      const filtered = events.filter(e => {
        const ts = new Date(e.timestamp);
        if (ts < start || ts > end) return false;
        if (campaignIds && !campaignIds.includes(e.campaignId)) return false;
        return true;
      });
      allEvents.push(...filtered);
    } catch {
      // shard may not exist
    }
    current.setMonth(current.getMonth() + 1);
  }

  // Aggregate by day
  const daily = {};
  for (const evt of allEvents) {
    const day = evt.timestamp.split('T')[0];
    if (!daily[day]) {
      daily[day] = { date: day, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    }
    if (daily[day][evt.eventType] !== undefined) {
      daily[day][evt.eventType]++;
    }
  }

  const dailyArray = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));

  // Totals
  const totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
  for (const evt of allEvents) {
    if (totals[evt.eventType] !== undefined) {
      totals[evt.eventType]++;
    }
  }

  return {
    totals,
    daily: dailyArray,
    openRate: totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(2) : '0.00',
    clickRate: totals.sent > 0 ? ((totals.clicked / totals.sent) * 100).toFixed(2) : '0.00',
    bounceRate: totals.sent > 0 ? ((totals.bounced / totals.sent) * 100).toFixed(2) : '0.00',
  };
}
