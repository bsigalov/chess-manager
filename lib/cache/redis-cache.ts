import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });

    return redis;
  } catch {
    return null;
  }
}

/**
 * Get a value from Redis, parsed as JSON.
 * Returns null on cache miss or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;

    const raw = await client.get(key);
    if (raw === null) return null;

    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("Redis cacheGet error:", err);
    return null;
  }
}

/**
 * Set a value in Redis with a TTL in seconds.
 * No-op if Redis is unavailable.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    const serialized = JSON.stringify(value);
    await client.set(key, serialized, "EX", ttlSeconds);
  } catch (err) {
    console.error("Redis cacheSet error:", err);
  }
}

/**
 * Invalidate all keys matching a pattern using SCAN + DEL.
 * Uses SCAN to avoid blocking the Redis server on large keyspaces.
 * No-op if Redis is unavailable.
 *
 * Example: cacheInvalidate('tournament:abc-123:*')
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    let cursor = "0";

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("Redis cacheInvalidate error:", err);
  }
}

/**
 * Delete a single key from Redis.
 * No-op if Redis is unavailable.
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    await client.del(key);
  } catch (err) {
    console.error("Redis cacheDelete error:", err);
  }
}
