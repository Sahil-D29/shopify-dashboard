import fs from 'fs';
import path from 'path';

// Get the project root directory (process.cwd() in Next.js is the project root)
// In Next.js, process.cwd() returns the project root directory
function getDataDir(): string {
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'data');
  
  // Ensure data directory exists
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
  
  return dataDir;
}

/**
 * Safely read JSON file with atomic write protection
 */
export function readJsonFile<T>(filename: string): T[] {
  try {
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      // Create file with empty array if it doesn't exist
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
 */
export function writeJsonFile<T>(filename: string, data: T[]): void {
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
    throw new Error(`Failed to write ${filename}: ${message}`);
  }
}

/**
 * Get full path to a data file
 */
export function getDataFilePath(filename: string): string {
  const dataDir = getDataDir();
  return path.join(dataDir, filename);
}

