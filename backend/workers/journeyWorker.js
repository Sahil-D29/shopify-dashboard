// backend/workers/journeyWorker.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { getPendingEvents, markEventProcessed } from '../services/journeysService.js';
import { runJourneyEvent } from './journeyExecutor.js';
import { logError } from '../utils/logger.js';
import { updateWorkerStatus } from '../utils/systemHealth.js';

const eventsFile = path.join(process.cwd(), 'backend', 'data', 'journey-events.json');

let running = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function startJourneyWorker() {
  if (running) {
    console.log('⚠️  Journey worker already running');
    return;
  }
  
  running = true;
  console.log('✅ Journey worker started');
  
  // Update health status
  await updateWorkerStatus('journey', 'running').catch(err => {
    console.warn('Failed to update journey worker status:', err.message);
  });
  
  // Start worker loop
  process.nextTick(workerLoop);
}

export async function stopJourneyWorker() {
  running = false;
  console.log('🛑 Journey worker stopped');
  
  // Update health status
  await updateWorkerStatus('journey', 'stopped').catch(err => {
    console.warn('Failed to update journey worker status:', err.message);
  });
}

async function workerLoop() {
  while (running) {
    try {
      const events = await getPendingEvents();
      
      if (events.length === 0) {
        await sleep(2000); // Wait 2 seconds if no events
        continue;
      }
      
      // Process first event
      const event = events[0];
      
      try {
        // Mark as processing
        await markEventProcessed(event.id);
        
        // Execute journey
        await runJourneyEvent(event);
        
        console.log(`✅ Journey event ${event.id} processed successfully`);
      } catch (e) {
        console.error(`❌ Journey event ${event.id} failed:`, e.message);
        
        // Mark as failed but keep it for manual review
        const evtsData = await readFileSafe(eventsFile, { default: { events: [] } });
        const evt = evtsData.events.find(e => e.id === event.id);
        if (evt) {
          evt.processed = true;
          evt.failed = true;
          evt.error = e.message;
          evt.failedAt = new Date().toISOString();
          await writeFileSafe(eventsFile, evtsData);
        }
        
        await logError({
          message: `Journey worker error: ${e.message}`,
          stack: e.stack,
          eventId: event.id,
          journeyId: event.journeyId
        });
      }
    } catch (e) {
      console.error('Journey worker loop error:', e.message);
      
      // Update status to crashed if critical error
      if (e.message.includes('fatal') || e.message.includes('critical')) {
        await updateWorkerStatus('journey', 'crashed').catch(() => {});
      }
      
      await logError({
        message: `Journey worker loop error: ${e.message}`,
        stack: e.stack
      });
      await sleep(5000); // Wait 5 seconds on error
    }
  }
}

// Note: Graceful shutdown is handled in server.js

