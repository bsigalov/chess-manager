import { cacheGet, cacheSet } from "./redis-cache";
import { memGet, memSet } from "./memory-cache";

export { cacheGet, cacheSet, cacheDelete, cacheInvalidate } from "./redis-cache";
export { memGet, memSet, memDelete } from "./memory-cache";

interface CachedFetchOptions {
  /** TTL for the in-memory LRU cache in milliseconds. Default: 30000 (30s). */
  memTtlMs?: number;
  /** TTL for the Redis cache in seconds. Default: 300 (5min). */
  redisTtlSec?: number;
}

/**
 * Two-tier cached fetch: memory -> Redis -> fetcher.
 *
 * 1. Check the in-memory LRU cache.
 * 2. Check the Redis cache.
 * 3. Call the fetcher function.
 * 4. Store the result in both caches.
 * 5. Return the result.
 *
 * If Redis is unavailable, falls back gracefully to memory-only caching.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedFetchOptions = {}
): Promise<T> {
  const { memTtlMs, redisTtlSec = 300 } = options;

  // 1. Check memory cache
  const memValue = memGet<T>(key);
  if (memValue !== undefined) {
    return memValue;
  }

  // 2. Check Redis cache
  const redisValue = await cacheGet<T>(key);
  if (redisValue !== null) {
    // Populate memory cache from Redis hit
    memSet(key, redisValue, memTtlMs);
    return redisValue;
  }

  // 3. Call the fetcher
  const freshValue = await fetcher();

  // 4. Store in both caches
  memSet(key, freshValue, memTtlMs);
  await cacheSet(key, freshValue, redisTtlSec);

  // 5. Return
  return freshValue;
}
