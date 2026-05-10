// backend/workers/campaignWorker.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { processCampaignExecution } from './campaignExecutor.js';
import { logError } from '../utils/logger.js';
import { updateWorkerStatus } from '../utils/systemHealth.js';

const queueFile = path.join(process.cwd(), 'backend', 'data', 'campaign-queue.json');

let running = false;
let workerInterval = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function startCampaignWorker() {
  if (running) {
    console.log('⚠️  Campaign worker already running');
    return;
  }
  
  running = true;
  console.log('✅ Campaign worker started');
  
  // Update health status
  await updateWorkerStatus('campaign', 'running').catch(err => {
    console.warn('Failed to update campaign worker status:', err.message);
  });
  
  // Start worker loop
  process.nextTick(workerLoop);
}

export async function stopCampaignWorker() {
  running = false;
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  console.log('🛑 Campaign worker stopped');
  
  // Update health status
  await updateWorkerStatus('campaign', 'stopped').catch(err => {
    console.warn('Failed to update campaign worker status:', err.message);
  });
}

async function workerLoop() {
  while (running) {
    try {
      const queueData = await readFileSafe(queueFile, { default: { queue: [] } });
      const queue = queueData.queue || [];
      
      if (queue.length === 0) {
        await sleep(2000); // Wait 2 seconds if queue is empty
        continue;
      }
      
      // Sort by scheduledAt, get earliest
      const sorted = queue
        .filter(q => q.status === 'pending' || !q.status)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
      
      const item = sorted[0];
      
      if (!item) {
        await sleep(2000);
        continue;
      }
      
      const scheduledTime = new Date(item.scheduledAt);
      const now = new Date();
      
      // If not yet time, wait a bit
      if (scheduledTime > now) {
        await sleep(1000);
        continue;
      }
      
      // Mark as processing
      item.status = 'processing';
      item.startedAt = new Date().toISOString();
      await writeFileSafe(queueFile, queueData);
      
      try {
        // Execute campaign
        await processCampaignExecution(item);
        
        // Remove from queue
        queueData.queue = queueData.queue.filter(q => q.id !== item.id);
        await writeFileSafe(queueFile, queueData);
        
        console.log(`✅ Campaign ${item.campaignId} executed successfully`);
      } catch (e) {
        console.error(`❌ Campaign ${item.campaignId} execution failed:`, e.message);
        
        // Update retry count
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = e.message;
        item.lastAttempt = new Date().toISOString();
        
        const maxRetries = parseInt(process.env.CAMPAIGN_RETRY_LIMIT || '3');
        if (item.retryCount >= maxRetries) {
          // Remove from queue after max retries
          queueData.queue = queueData.queue.filter(q => q.id !== item.id);
          console.log(`⚠️  Campaign ${item.campaignId} removed from queue after ${maxRetries} retries`);
        } else {
          // Reschedule for retry (1 minute later)
          item.scheduledAt = new Date(Date.now() + 60000).toISOString();
          item.status = 'pending';
        }
        
        await writeFileSafe(queueFile, queueData);
        
        await logError({
          message: `Campaign worker error: ${e.message}`,
          stack: e.stack,
          campaignId: item.campaignId,
          retryCount: item.retryCount
        });
      }
    } catch (e) {
      console.error('Campaign worker loop error:', e.message);
      
      // Update status to crashed if critical error
      if (e.message.includes('fatal') || e.message.includes('critical')) {
        await updateWorkerStatus('campaign', 'crashed').catch(() => {});
      }
      
      await logError({
        message: `Campaign worker loop error: ${e.message}`,
        stack: e.stack
      });
      await sleep(5000); // Wait 5 seconds on error
    }
  }
}

// Note: Graceful shutdown is handled in server.js

