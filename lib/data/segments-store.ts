import { CustomerSegment } from '@/lib/types/segment';

// Simple in-memory store for development. Replace with DB in production.
const segments: CustomerSegment[] = [];

export const SegmentsStore = {
  list(): CustomerSegment[] {
    return segments;
  },
  get(id: string): CustomerSegment | undefined {
    return segments.find(s => s.id === id);
  },
  create(data: Omit<CustomerSegment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): CustomerSegment {
    const segment: CustomerSegment = {
      id: data.id ?? `seg_${Date.now()}`,
      name: data.name,
      description: data.description,
      type: data.type,
      conditionGroups: data.conditionGroups ?? [],
      customerCount: data.customerCount ?? 0,
      totalRevenue: data.totalRevenue ?? 0,
      averageOrderValue: data.averageOrderValue ?? 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: data.isArchived ?? false,
      lastCalculated: data.lastCalculated,
      folderId: data.folderId,
    };
    segments.push(segment);
    return segment;
  },
  update(id: string, updates: Partial<CustomerSegment>): CustomerSegment | undefined {
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    segments[idx] = { ...segments[idx], ...updates, updatedAt: Date.now() };
    return segments[idx];
  },
  delete(id: string): boolean {
    const idx = segments.findIndex(s => s.id === id);
    if (idx === -1) return false;
    segments.splice(idx, 1);
    return true;
  },
};


