// Simple in-memory cache with expiry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number; // milliseconds
}

class Cache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultExpiry = 5 * 60 * 1000; // 5 minutes in milliseconds

  set<T>(key: string, data: T, expiryMs?: number): void {
    const expiry = expiryMs || this.defaultExpiry;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getTimestamp(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.timestamp;
  }
}

// Export singleton instance
export const cache = new Cache();
