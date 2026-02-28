import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(clubId: string): string {
  return path.join(CACHE_DIR, `club-${clubId}.json`);
}

export function getCachedClubData<T>(clubId: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const filePath = cacheFilePath(clubId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedClubData<T>(clubId: string, data: T): void {
  ensureCacheDir();
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  fs.writeFileSync(cacheFilePath(clubId), JSON.stringify(entry, null, 2));
}

export function getCacheAge(clubId: string): number | null {
  const filePath = cacheFilePath(clubId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
}
