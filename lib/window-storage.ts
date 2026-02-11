/* eslint-disable no-console */

/**
 * Lightweight storage adapter that fulfils the spec requirement of exposing
 * `window.storage` for persistent data.
 *
 * Internally this uses `localStorage` when available and gracefully falls back
 * to an in‑memory map so that SSR and private browsing modes keep working.
 */

export type StoragePrimitive = string | number | boolean | null | undefined;

export interface WindowStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: StoragePrimitive): void;
  remove(key: string): void;
  clearPrefix(prefix: string): void;
  getJSON<T = unknown>(key: string, fallback?: T): T | null;
  setJSON(key: string, value: unknown): void;
  keys(): string[];
}

const memoryStore = new Map<string, string>();

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isLocalStorageAvailable(): boolean {
  if (!isBrowser()) return false;
  try {
    const testKey = '__window_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function normaliseValue(value: StoragePrimitive): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

function createAdapter(): WindowStorageAdapter {
  const hasLocalStorage = isLocalStorageAvailable();

  const get = (key: string): string | null => {
    if (hasLocalStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore.get(key) ?? null;
  };

  const set = (key: string, value: StoragePrimitive) => {
    const serialised = normaliseValue(value);
    if (hasLocalStorage) {
      try {
        window.localStorage.setItem(key, serialised);
      } catch (error) {
        console.warn('[window.storage] failed to persist value, falling back to memory store', error);
        memoryStore.set(key, serialised);
      }
      return;
    }
    memoryStore.set(key, serialised);
  };

  const remove = (key: string) => {
    if (hasLocalStorage) {
      window.localStorage.removeItem(key);
    }
    memoryStore.delete(key);
  };

  const clearPrefix = (prefix: string) => {
    if (hasLocalStorage) {
      Object.keys(window.localStorage)
        .filter(key => key.startsWith(prefix))
        .forEach(key => {
          window.localStorage.removeItem(key);
        });
    }
    Array.from(memoryStore.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => memoryStore.delete(key));
  };

  const getJSON = <T = unknown>(key: string, fallback?: T): T | null => {
    const raw = get(key);
    if (raw == null || raw === '') {
      return fallback ?? null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`[window.storage] failed to parse JSON value for key "${key}"`, error);
      return fallback ?? null;
    }
  };

  const setJSON = (key: string, value: unknown) => {
    try {
      const serialised = JSON.stringify(value);
      set(key, serialised);
    } catch (error) {
      console.error(`[window.storage] failed to serialise JSON for key "${key}"`, error);
    }
  };

  const keys = (): string[] => {
    if (hasLocalStorage) {
      return Object.keys(window.localStorage);
    }
    return Array.from(memoryStore.keys());
  };

  return { get, set, remove, clearPrefix, getJSON, setJSON, keys };
}

let cachedAdapter: WindowStorageAdapter | null = null;

export function getWindowStorage(): WindowStorageAdapter {
  if (cachedAdapter) return cachedAdapter;

  const adapter = createAdapter();
  cachedAdapter = adapter;

  if (isBrowser()) {
    const win = window as typeof window & { storage?: WindowStorageAdapter };
    if (!win.storage) {
      win.storage = adapter;
    }
  }

  return adapter;
}

export function resetWindowStorageForTests(): void {
  cachedAdapter = null;
  memoryStore.clear();
}

declare global {
  interface Window {
    storage?: WindowStorageAdapter;
  }
}


