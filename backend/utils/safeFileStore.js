// backend/utils/safeFileStore.js
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCKS = new Map();

function getLock(filePath) {
  if (!LOCKS.has(filePath)) {
    LOCKS.set(filePath, Promise.resolve());
  }
  return LOCKS.get(filePath);
}

function setLock(filePath, p) {
  LOCKS.set(filePath, p);
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore if already exists
    if (e.code !== 'EEXIST') throw e;
  }
}

async function backup(filePath) {
  try {
    if (!fsSync.existsSync(filePath)) return;
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    
    // Rotate backups: .bak.5 -> .bak.6 (delete), .bak.4 -> .bak.5, ..., .bak.1 -> .bak.2
    for (let i = 4; i >= 1; i--) {
      const from = path.join(dir, `${base}.bak.${i}`);
      const to = path.join(dir, `${base}.bak.${i + 1}`);
      if (fsSync.existsSync(from)) {
        try {
          await fs.copyFile(from, to);
        } catch (e) {
          // Ignore copy errors for backup rotation
          console.warn(`Backup rotation warning for ${from}:`, e.message);
        }
      }
    }
    
    // Create new backup
    await fs.copyFile(filePath, path.join(dir, `${base}.bak.1`));
  } catch (e) {
    console.error('Backup failed for', filePath, e.message);
  }
}

async function restoreBackup(filePath) {
  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    
    for (let i = 1; i <= 5; i++) {
      const backupFile = path.join(dir, `${base}.bak.${i}`);
      if (fsSync.existsSync(backupFile)) {
        await fs.copyFile(backupFile, filePath);
        console.log(`Restored from backup ${i}:`, filePath);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('Restore backup failed for', filePath, e.message);
    return false;
  }
}

export async function readFileSafe(filePath, opts = { default: {} }) {
  const lock = getLock(filePath);
  await lock;
  
  try {
    if (!fsSync.existsSync(filePath)) {
      await ensureDir(path.dirname(filePath));
      await writeFileSafe(filePath, opts.default);
      return opts.default;
    }
    
    const raw = await fs.readFile(filePath, 'utf8');
    
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      console.error('JSON parse error, attempting restore:', filePath, parseError.message);
      const restored = await restoreBackup(filePath);
      
      if (restored) {
        const raw2 = await fs.readFile(filePath, 'utf8');
        try {
          return JSON.parse(raw2);
        } catch (e2) {
          console.error('Restored file also invalid JSON:', filePath);
          return opts.default;
        }
      } else {
        console.error('No backup available, using default:', filePath);
        return opts.default;
      }
    }
  } catch (e) {
    console.error('readFileSafe failed:', filePath, e.message);
    throw e;
  }
}

export async function writeFileSafe(filePath, data) {
  // Queue by file path
  const prev = getLock(filePath);
  const p = prev.then(async () => {
    await ensureDir(path.dirname(filePath));
    
    // Backup existing file before overwrite
    await backup(filePath);
    
    // Atomic write: write to temp file, fsync, then rename
    const tmp = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
    const json = JSON.stringify(data, null, 2);
    
    await fs.writeFile(tmp, json, 'utf8');
    
    // Force fsync to disk
    const fd = fsSync.openSync(tmp, 'r');
    fsSync.fsyncSync(fd);
    fsSync.closeSync(fd);
    
    // Atomic rename
    await fs.rename(tmp, filePath);
    
    return true;
  }).catch(async (err) => {
    console.error('writeFileSafe error:', filePath, err.message);
    
    // Attempt restore from backup
    try {
      await restoreBackup(filePath);
    } catch (restoreErr) {
      console.error('Failed to restore after write error:', restoreErr.message);
    }
    
    throw err;
  });
  
  setLock(filePath, p);
  return p;
}

export async function appendFileSafe(filePath, newEntry) {
  const obj = await readFileSafe(filePath, { default: {} });
  
  if (Array.isArray(obj)) {
    obj.push(newEntry);
    await writeFileSafe(filePath, obj);
    return obj;
  } else if (typeof obj === 'object') {
    // If object has an array property, append to it
    if (Array.isArray(obj.items)) {
      obj.items.push(newEntry);
    } else if (Array.isArray(obj.events)) {
      obj.events.push(newEntry);
    } else if (Array.isArray(obj.queue)) {
      obj.queue.push(newEntry);
    } else {
      // Default: create 'items' array
      if (!obj.items) obj.items = [];
      obj.items.push(newEntry);
    }
    await writeFileSafe(filePath, obj);
    return obj;
  } else {
    throw new Error('Unsupported appendFileSafe format: expected array or object');
  }
}


