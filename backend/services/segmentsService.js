// backend/services/segmentsService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const file = path.join(process.cwd(), 'backend', 'data', 'segments.json');

export async function loadSegments() {
  const data = await readFileSafe(file, { default: { segments: [] } });
  return data.segments || [];
}

export async function saveSegments(segments) {
  await writeFileSafe(file, { segments });
}

export async function getSegmentById(id) {
  const segments = await loadSegments();
  return segments.find(s => s.id === id);
}

export async function getSegmentsByStore(storeId) {
  const segments = await loadSegments();
  return segments.filter(s => s.storeId === storeId);
}

export async function createSegment(segment, actorId) {
  const segments = await loadSegments();
  const newSegment = {
    ...segment,
    id: segment.id || `seg_${uuidv4()}`,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  segments.push(newSegment);
  await saveSegments(segments);
  
  await logActivity({
    type: 'segment_created',
    actorId: actorId,
    storeId: segment.storeId,
    segmentId: newSegment.id,
    segmentName: segment.name
  });
  
  return newSegment;
}

export async function updateSegment(id, patch, actorId) {
  const segments = await loadSegments();
  const idx = segments.findIndex(s => s.id === id);
  
  if (idx === -1) {
    throw new Error('Segment not found');
  }
  
  const oldSegment = { ...segments[idx] };
  segments[idx] = {
    ...segments[idx],
    ...patch,
    version: (segments[idx].version || 1) + 1,
    updatedAt: new Date().toISOString()
  };
  
  await saveSegments(segments);
  
  await logActivity({
    type: 'segment_updated',
    actorId: actorId,
    storeId: segments[idx].storeId,
    segmentId: id,
    segmentName: segments[idx].name,
    changes: Object.keys(patch)
  });
  
  return segments[idx];
}

export async function deleteSegment(id, actorId) {
  const segments = await loadSegments();
  const segment = segments.find(s => s.id === id);
  
  if (!segment) {
    throw new Error('Segment not found');
  }
  
  const filtered = segments.filter(s => s.id !== id);
  await saveSegments(filtered);
  
  await logActivity({
    type: 'segment_deleted',
    actorId: actorId,
    storeId: segment.storeId,
    segmentId: id,
    segmentName: segment.name
  });
  
  return true;
}


