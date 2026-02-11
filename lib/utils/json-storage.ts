import fs from 'fs';
import path from 'path';

/**
 * ⚠️ DEPRECATED (DATA STORAGE)
 *
 * The application has migrated transactional data (campaigns/segments/journeys/etc.)
 * to PostgreSQL via Prisma repositories.
 *
 * This file is retained only for **legacy/migration** and **non-transactional**
 * file-based artifacts (temporary caches, one-off scripts, etc.).
 *
 * New code MUST NOT use JSON files for data persistence. Prefer Prisma.
 */

let warned = false;
function warnDeprecatedOnce(op: string, filename: string) {
  if (warned) return;
  warned = true;
  // Keep as console.warn (not error) to avoid noisy crash reports.
  console.warn(
    `[DEPRECATED][json-storage] ${op}("${filename}") called. ` +
      `JSON file storage is legacy/migration-only. Prefer Prisma/PostgreSQL.`,
  );
}

// Get the project root directory (process.cwd() in Next.js is the project root)
// In Next.js, process.cwd() returns the project root directory
function getDataDir(): string {
  // On Vercel, file system is read-only, so we can't create directories
  // Return a path but operations will fail gracefully
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'data');
  
  // Only try to create directory if not on Vercel (read-only filesystem)
  if (process.env.VERCEL !== '1') {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }
  
  return dataDir;
}

/**
 * Safely read JSON file with atomic write protection
 * On Vercel (read-only filesystem), returns empty array gracefully
 */
export function readJsonFile<T>(filename: string): T[] {
  warnDeprecatedOnce('readJsonFile', filename);
  
  // On Vercel, file system is read-only - return empty array
  if (process.env.VERCEL === '1') {
    console.warn(`[json-storage] Vercel read-only filesystem: returning empty array for ${filename}`);
    return [] as unknown as T[];
  }
  
  try {
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      // Create file with empty array if it doesn't exist (only if not on Vercel)
      try {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      } catch (writeError) {
        const message = writeError instanceof Error ? writeError.message : String(writeError);
        console.error(`Error creating ${filename}:`, message);
      }
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return [] as unknown as T[];
    }
    
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      console.error(`Invalid JSON format in ${filename}, expected array`);
      return [];
    }
    
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`Error reading ${filename}:`, message);
    if (stack) {
      console.error('Stack:', stack);
    }
    // Return empty array on error to prevent crashes
    return [];
  }
}

/**
 * Safely write JSON file with atomic operation
 * Uses writeFileSync with a temporary file first, then renames it
 * On Vercel (read-only filesystem), this is a no-op
 */
export function writeJsonFile<T>(filename: string, data: T[]): void {
  warnDeprecatedOnce('writeJsonFile', filename);
  
  // On Vercel, file system is read-only - silently fail
  if (process.env.VERCEL === '1') {
    console.warn(`[json-storage] Vercel read-only filesystem: writeJsonFile("${filename}") is a no-op`);
    return;
  }
  
  try {
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);
    const tempPath = path.join(dataDir, `${filename}.tmp`);
    
    // Write to temporary file first
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');
    
    // Atomic rename (replace) - this is atomic on most filesystems
    fs.renameSync(tempPath, filePath);
    
    // Verify the write was successful
    const verify = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(verify); // Will throw if invalid JSON
  } catch (error) {
    const dataDir = getDataDir();
    const tempPath = path.join(dataDir, `${filename}.tmp`);
    
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`Error writing ${filename}:`, message);
    if (stack) {
      console.error('Stack:', stack);
    }
    // Don't throw on Vercel - just log the error
    if (process.env.VERCEL !== '1') {
      throw new Error(`Failed to write ${filename}: ${message}`);
    }
  }
}

/**
 * Get full path to a data file
 */
export function getDataFilePath(filename: string): string {
  warnDeprecatedOnce('getDataFilePath', filename);
  const dataDir = getDataDir();
  return path.join(dataDir, filename);
}

