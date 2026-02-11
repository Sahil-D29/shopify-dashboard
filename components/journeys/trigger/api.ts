'use client';

import type {
  PreviewRequestPayload,
  PreviewResponse,
} from './types';

interface EventSummary {
  name: string;
  displayName?: string;
  recentCount?: number;
}

interface EventProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  exampleValues?: Array<string | number>;
}

export interface UserProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  values?: Array<string | number>;
}

export async function fetchEvents(search = '', limit = 50): Promise<EventSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('limit', String(limit));

  const response = await fetch(`/api/events?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load events (${response.status})`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.events) ? (payload.events as EventSummary[]) : [];
}

export async function fetchEventProperties(eventName: string): Promise<EventProperty[]> {
  if (!eventName) return [];
  const response = await fetch(`/api/events/${encodeURIComponent(eventName)}/properties`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load properties for ${eventName}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.properties) ? (payload.properties as EventProperty[]) : [];
}

export async function fetchUserProperties(): Promise<UserProperty[]> {
  const response = await fetch('/api/user/properties', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to load user properties');
  }
  const payload = await response.json();
  return Array.isArray(payload?.properties) ? (payload.properties as UserProperty[]) : [];
}

export async function fetchReachPreview(body: PreviewRequestPayload): Promise<PreviewResponse> {
  const response = await fetch('/api/preview/reach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Unable to calculate reach preview');
  }

  const payload = (await response.json()) as PreviewResponse;
  return payload;
}

