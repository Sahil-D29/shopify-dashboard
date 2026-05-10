// backend/services/campaignsService.js
import path from 'path';
import { readFileSafe, writeFileSafe, appendFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const campaignsFile = path.join(process.cwd(), 'backend', 'data', 'campaigns.json');
const queueFile = path.join(process.cwd(), 'backend', 'data', 'campaign-queue.json');
const logFile = path.join(process.cwd(), 'backend', 'data', 'campaign-logs.json');

// Campaign lifecycle: draft -> scheduled -> queued -> running -> completed | failed

export async function loadCampaigns() {
  const data = await readFileSafe(campaignsFile, { default: { campaigns: [] } });
  return data.campaigns || [];
}

export async function saveCampaigns(campaigns) {
  await writeFileSafe(campaignsFile, { campaigns });
}

export async function getCampaignById(id) {
  const campaigns = await loadCampaigns();
  return campaigns.find(c => c.id === id);
}

export async function getCampaignsByStore(storeId) {
  const campaigns = await loadCampaigns();
  return campaigns.filter(c => c.storeId === storeId);
}

export async function createCampaign(payload, actorId) {
  const campaigns = await loadCampaigns();
  const campaign = {
    id: `camp_${uuidv4()}`,
    state: 'draft',
    status: 'DRAFT',
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId,
    metrics: payload.metrics || {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      failed: 0,
      unsubscribed: 0,
      revenue: 0
    }
  };
  
  campaigns.push(campaign);
  await saveCampaigns(campaigns);
  
  await logActivity({
    type: 'campaign_created',
    actorId: actorId,
    storeId: payload.storeId,
    campaignId: campaign.id,
    campaignName: payload.name
  });
  
  return campaign;
}

export async function updateCampaign(id, patch, actorId) {
  const campaigns = await loadCampaigns();
  const idx = campaigns.findIndex(c => c.id === id);
  
  if (idx === -1) {
    throw new Error('Campaign not found');
  }
  
  campaigns[idx] = {
    ...campaigns[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  
  await saveCampaigns(campaigns);
  
  await logActivity({
    type: 'campaign_updated',
    actorId: actorId,
    storeId: campaigns[idx].storeId,
    campaignId: id,
    campaignName: campaigns[idx].name
  });
  
  return campaigns[idx];
}

export async function deleteCampaign(id, actorId) {
  const campaigns = await loadCampaigns();
  const campaign = campaigns.find(c => c.id === id);
  
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  const filtered = campaigns.filter(c => c.id !== id);
  await saveCampaigns(filtered);
  
  // Remove from queue if present
  const queueData = await readFileSafe(queueFile, { default: { queue: [] } });
  queueData.queue = queueData.queue.filter(q => q.campaignId !== id);
  await writeFileSafe(queueFile, queueData);
  
  await logActivity({
    type: 'campaign_deleted',
    actorId: actorId,
    storeId: campaign.storeId,
    campaignId: id,
    campaignName: campaign.name
  });
  
  return true;
}

export async function scheduleCampaign(campaignId, scheduledAt, actorId) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  // Update campaign state
  await updateCampaign(campaignId, {
    state: 'scheduled',
    status: 'SCHEDULED',
    scheduledAt: scheduledAt
  }, actorId);
  
  // Add to queue
  const queueData = await readFileSafe(queueFile, { default: { queue: [] } });
  const queueItem = {
    id: `q_${uuidv4()}`,
    campaignId: campaignId,
    scheduledAt: scheduledAt,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  };
  
  queueData.queue = queueData.queue || [];
  queueData.queue.push(queueItem);
  await writeFileSafe(queueFile, queueData);
  
  await logActivity({
    type: 'campaign_scheduled',
    actorId: actorId,
    storeId: campaign.storeId,
    campaignId: campaignId,
    scheduledAt: scheduledAt
  });
  
  return queueItem;
}

export async function getQueue() {
  const queueData = await readFileSafe(queueFile, { default: { queue: [] } });
  return queueData.queue || [];
}

export async function removeFromQueue(queueItemId) {
  const queueData = await readFileSafe(queueFile, { default: { queue: [] } });
  queueData.queue = queueData.queue.filter(q => q.id !== queueItemId);
  await writeFileSafe(queueFile, queueData);
  return true;
}

export async function logCampaignExecution(entry) {
  await appendFileSafe(logFile, {
    ...entry,
    id: `clog_${uuidv4()}`,
    timestamp: new Date().toISOString()
  });
}

export async function getCampaignLogs(campaignId) {
  const logsData = await readFileSafe(logFile, { default: { items: [] } });
  const items = logsData.items || logsData; // Support both formats
  return Array.isArray(items) ? items.filter(l => l.campaignId === campaignId) : [];
}


