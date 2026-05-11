// backend/utils/fileStorage.js
// File storage utility with atomic operations
// This will be replaced with database operations later

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get data directory from environment or use default
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'backend', 'data');

// File locks to prevent race conditions
const LOCKS = new Map();

/**
 * Get lock for a file path
 * @param {string} filePath - File path
 * @returns {Promise}
 */
function getLock(filePath) {
  if (!LOCKS.has(filePath)) {
    LOCKS.set(filePath, Promise.resolve());
  }
  return LOCKS.get(filePath);
}

/**
 * Set lock for a file path
 * @param {string} filePath - File path
 * @param {Promise} promise - Promise to lock
 */
function setLock(filePath, promise) {
  LOCKS.set(filePath, promise);
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Get full file path
 * @param {string} filename - Filename
 * @returns {string}
 */
export function getDataFilePath(filename) {
  return path.join(DATA_DIR, filename);
}

/**
 * Read JSON file safely with default value
 * @param {string} filename - Filename in data directory
 * @param {object} options - Options
 * @param {any} options.default - Default value if file doesn't exist
 * @returns {Promise<any>}
 */
export async function readFileSafe(filename, options = {}) {
  const filePath = getDataFilePath(filename);
  const { default: defaultValue = null } = options;
  
  try {
    await ensureDir(DATA_DIR);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT' && defaultValue !== undefined) {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Write JSON file atomically (write to temp, then rename)
 * @param {string} filename - Filename in data directory
 * @param {any} data - Data to write
 * @param {object} options - Options
 * @param {boolean} options.backup - Create backup before write
 * @returns {Promise<void>}
 */
export async function writeFileSafe(filename, data, options = {}) {
  const filePath = getDataFilePath(filename);
  const { backup = true } = options;
  
  // Wait for any existing lock
  const lock = getLock(filePath);
  await lock;
  
  // Create new lock
  const writePromise = (async () => {
    try {
      await ensureDir(DATA_DIR);
      
      // Create backup if requested and file exists
      if (backup) {
        try {
          await fs.access(filePath);
          const backupPath = `${filePath}.backup.${Date.now()}`;
          await fs.copyFile(filePath, backupPath);
          
          // Clean up old backups (keep last 5)
          try {
            const files = await fs.readdir(DATA_DIR);
            const backups = files
              .filter(f => f.startsWith(path.basename(filename) + '.backup.'))
              .sort()
              .reverse()
              .slice(5);
            
            for (const backupFile of backups) {
              await fs.unlink(path.join(DATA_DIR, backupFile));
            }
          } catch (err) {
            // Ignore backup cleanup errors
          }
        } catch (err) {
          // File doesn't exist, no backup needed
        }
      }
      
      // Write to temporary file first
      const tempPath = `${filePath}.tmp.${crypto.randomBytes(8).toString('hex')}`;
      const jsonContent = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonContent, 'utf-8');
      
      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      throw new Error(`Failed to write file ${filename}: ${error.message}`);
    }
  })();
  
  setLock(filePath, writePromise);
  await writePromise;
}

/**
 * Initialize data file with schema
 * @param {string} filename - Filename
 * @param {any} schema - Initial schema/structure
 * @returns {Promise<void>}
 */
export async function initializeDataFile(filename, schema) {
  const filePath = getDataFilePath(filename);
  
  try {
    await fs.access(filePath);
    // File exists, no need to initialize
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create with schema
      await writeFileSafe(filename, schema, { backup: false });
    } else {
      throw error;
    }
  }
}

/**
 * Append to array in JSON file
 * @param {string} filename - Filename
 * @param {any} item - Item to append
 * @param {string} arrayKey - Key of array in JSON object
 * @returns {Promise<void>}
 */
export async function appendToArray(filename, item, arrayKey = 'items') {
  const data = await readFileSafe(filename, { default: { [arrayKey]: [] } });
  
  if (!Array.isArray(data[arrayKey])) {
    data[arrayKey] = [];
  }
  
  data[arrayKey].push(item);
  await writeFileSafe(filename, data);
}

/**
 * Update item in array by ID
 * @param {string} filename - Filename
 * @param {string} id - Item ID
 * @param {object} updates - Updates to apply
 * @param {string} arrayKey - Key of array in JSON object
 * @param {string} idKey - Key of ID field
 * @returns {Promise<boolean>} - Returns true if updated, false if not found
 */
export async function updateArrayItem(filename, id, updates, arrayKey = 'items', idKey = 'id') {
  const data = await readFileSafe(filename, { default: { [arrayKey]: [] } });
  
  if (!Array.isArray(data[arrayKey])) {
    return false;
  }
  
  const index = data[arrayKey].findIndex(item => item[idKey] === id);
  if (index === -1) {
    return false;
  }
  
  data[arrayKey][index] = {
    ...data[arrayKey][index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await writeFileSafe(filename, data);
  return true;
}

/**
 * Delete item from array by ID
 * @param {string} filename - Filename
 * @param {string} id - Item ID
 * @param {string} arrayKey - Key of array in JSON object
 * @param {string} idKey - Key of ID field
 * @returns {Promise<boolean>} - Returns true if deleted, false if not found
 */
export async function deleteArrayItem(filename, id, arrayKey = 'items', idKey = 'id') {
  const data = await readFileSafe(filename, { default: { [arrayKey]: [] } });
  
  if (!Array.isArray(data[arrayKey])) {
    return false;
  }
  
  const initialLength = data[arrayKey].length;
  data[arrayKey] = data[arrayKey].filter(item => item[idKey] !== id);
  
  if (data[arrayKey].length === initialLength) {
    return false;
  }
  
  await writeFileSafe(filename, data);
  return true;
}

