import crypto from 'crypto';

export function generateId(prefix: string): string {
  const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${id}`;
}

export function convertToMilliseconds(duration: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): number {
  const value = Number(duration ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (unit) {
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    case 'weeks':
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

export function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    return fallback;
  }
}

export function nextRetryDelay(
  attempt: number,
  strategy: 'exponential' | 'linear' = 'exponential',
  baseMs: number = 60_000,
  maxMs: number = 6 * 60 * 60 * 1000
): number {
  if (!Number.isFinite(attempt) || attempt <= 0) return baseMs;
  const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : 60_000;
  const max = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : 6 * 60 * 60 * 1000;
  const multiplier = strategy === 'linear' ? attempt : Math.pow(2, attempt - 1);
  const delay = Math.min(base * multiplier, max);
  const jitter = Math.round(delay * 0.15 * Math.random());
  return Math.min(delay + jitter, max);
}

