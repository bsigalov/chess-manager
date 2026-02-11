import { LRUCache } from "lru-cache";

// eslint-disable-next-line
const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 30_000, // 30 seconds default TTL
});

/**
 * Get a value from the in-memory LRU cache.
 * Returns undefined on cache miss.
 */
export function memGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/**
 * Set a value in the in-memory LRU cache.
 * @param ttlMs Optional TTL in milliseconds. Defaults to the cache-wide 30s TTL.
 */
export function memSet<T>(key: string, value: T, ttlMs?: number): void {
  const options = ttlMs != null ? { ttl: ttlMs } : undefined;
  cache.set(key, value, options);
}

/**
 * Delete a value from the in-memory LRU cache.
 */
export function memDelete(key: string): void {
  cache.delete(key);
}
