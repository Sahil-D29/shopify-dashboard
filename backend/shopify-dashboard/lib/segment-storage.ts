import fs from 'fs/promises';
import path from 'path';

const SEGMENTS_FILE = path.join(process.cwd(), 'data', 'segments.json');

export interface Segment {
  id: string;
  name: string;
  description?: string;
  filters: {
    conditions: any[];
    logic: 'AND' | 'OR';
  };
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  customerCount?: number;
}

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  const dataDir = path.dirname(SEGMENTS_FILE);
  await fs.mkdir(dataDir, { recursive: true });
}

/**
 * Load segments from file
 */
export async function loadSegments(): Promise<Segment[]> {
  try {
    const data = await fs.readFile(SEGMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both array format and object with segments property
    return Array.isArray(parsed) ? parsed : (parsed.segments || []);
  } catch (error) {
    // File doesn't exist yet
    return [];
  }
}

/**
 * Save segments to file
 */
export async function saveSegments(segments: Segment[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SEGMENTS_FILE, JSON.stringify({ segments }, null, 2), 'utf-8');
}

/**
 * Get segment by ID
 */
export async function getSegmentById(id: string): Promise<Segment | null> {
  const segments = await loadSegments();
  return segments.find(s => s.id === id) || null;
}

/**
 * Create segment
 */
export async function createSegment(segment: Omit<Segment, 'id' | 'createdAt'>): Promise<Segment> {
  const segments = await loadSegments();
  const newSegment: Segment = {
    ...segment,
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    createdAt: new Date().toISOString(),
  };
  
  segments.push(newSegment);
  await saveSegments(segments);
  
  return newSegment;
}

/**
 * Update segment
 */
export async function updateSegment(id: string, updates: Partial<Segment>): Promise<Segment | null> {
  const segments = await loadSegments();
  const index = segments.findIndex(s => s.id === id);
  
  if (index === -1) return null;
  
  segments[index] = { 
    ...segments[index], 
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveSegments(segments);
  
  return segments[index];
}

/**
 * Delete segment
 */
export async function deleteSegment(id: string): Promise<boolean> {
  const segments = await loadSegments();
  const filtered = segments.filter(s => s.id !== id);
  
  if (filtered.length === segments.length) return false;
  
  await saveSegments(filtered);
  return true;
}


