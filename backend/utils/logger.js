// backend/utils/logger.js
import { appendFileSafe } from './safeFileStore.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use backend/data directory
const dataDir = path.join(process.cwd(), 'backend', 'data');

export async function logActivity(entry) {
  const file = path.join(dataDir, 'activity-logs.json');
  const now = new Date().toISOString();
  const record = {
    ...entry,
    timestamp: now,
    id: `act_${Date.now()}_${Math.random().toString(36).substring(7)}`
  };
  
  try {
    await appendFileSafe(file, record);
  } catch (e) {
    console.error('logActivity failed:', e.message);
  }
}

export async function logError(entry) {
  const file = path.join(dataDir, 'error-logs.json');
  const now = new Date().toISOString();
  const record = {
    ...entry,
    timestamp: now,
    id: `err_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    stack: entry.stack || '',
    message: entry.message || String(entry)
  };
  
  try {
    await appendFileSafe(file, record);
  } catch (e) {
    console.error('logError failed:', e.message);
    // Last resort: console.error
    console.error('Error log entry:', record);
  }
}


