// backend/services/journeysService.js
import path from 'path';
import { readFileSafe, writeFileSafe, appendFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const file = path.join(process.cwd(), 'backend', 'data', 'journeys.json');
const eventsFile = path.join(process.cwd(), 'backend', 'data', 'journey-events.json');
const logsFile = path.join(process.cwd(), 'backend', 'data', 'journey-logs.json');

export async function loadJourneys() {
  const data = await readFileSafe(file, { default: { journeys: [] } });
  return data.journeys || [];
}

export async function saveJourneys(journeys) {
  await writeFileSafe(file, { journeys });
}

export async function getJourneyById(id) {
  const journeys = await loadJourneys();
  return journeys.find(j => j.id === id);
}

export async function getJourneysByStore(storeId) {
  const journeys = await loadJourneys();
  return journeys.filter(j => j.storeId === storeId);
}

export async function createJourney(payload, actorId) {
  const journeys = await loadJourneys();
  const journey = {
    id: `jour_${uuidv4()}`,
    ...payload,
    enabled: payload.enabled !== false, // Default to enabled
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId
  };
  
  journeys.push(journey);
  await saveJourneys(journeys);
  
  await logActivity({
    type: 'journey_created',
    actorId: actorId,
    storeId: payload.storeId,
    journeyId: journey.id,
    journeyName: payload.name
  });
  
  return journey;
}

export async function updateJourney(id, patch, actorId) {
  const journeys = await loadJourneys();
  const idx = journeys.findIndex(j => j.id === id);
  
  if (idx === -1) {
    throw new Error('Journey not found');
  }
  
  journeys[idx] = {
    ...journeys[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  
  await saveJourneys(journeys);
  
  await logActivity({
    type: 'journey_updated',
    actorId: actorId,
    storeId: journeys[idx].storeId,
    journeyId: id,
    journeyName: journeys[idx].name
  });
  
  return journeys[idx];
}

export async function deleteJourney(id, actorId) {
  const journeys = await loadJourneys();
  const journey = journeys.find(j => j.id === id);
  
  if (!journey) {
    throw new Error('Journey not found');
  }
  
  const filtered = journeys.filter(j => j.id !== id);
  await saveJourneys(filtered);
  
  await logActivity({
    type: 'journey_deleted',
    actorId: actorId,
    storeId: journey.storeId,
    journeyId: id,
    journeyName: journey.name
  });
  
  return true;
}

// Event handling
export async function pushJourneyEvent(event) {
  const evtsData = await readFileSafe(eventsFile, { default: { events: [] } });
  const newEvent = {
    id: `je_${uuidv4()}`,
    ...event,
    receivedAt: new Date().toISOString(),
    processed: false
  };
  
  evtsData.events = evtsData.events || [];
  evtsData.events.push(newEvent);
  await writeFileSafe(eventsFile, evtsData);
  
  return newEvent;
}

export async function getPendingEvents() {
  const evtsData = await readFileSafe(eventsFile, { default: { events: [] } });
  const events = evtsData.events || [];
  return events.filter(e => !e.processed);
}

export async function markEventProcessed(eventId) {
  const evtsData = await readFileSafe(eventsFile, { default: { events: [] } });
  const event = evtsData.events.find(e => e.id === eventId);
  if (event) {
    event.processed = true;
    event.processedAt = new Date().toISOString();
    await writeFileSafe(eventsFile, evtsData);
  }
  return event;
}

// Logging
export async function logJourneyExecution(entry) {
  await appendFileSafe(logsFile, {
    ...entry,
    id: `jlog_${uuidv4()}`,
    timestamp: new Date().toISOString()
  });
}

export async function getJourneyLogs(journeyId) {
  const logsData = await readFileSafe(logsFile, { default: { items: [] } });
  const items = logsData.items || logsData;
  return Array.isArray(items) ? items.filter(l => l.journeyId === journeyId) : [];
}


