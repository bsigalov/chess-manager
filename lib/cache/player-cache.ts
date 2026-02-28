/**
 * player-cache.ts
 * File-based cache for individual player deep data (Tier 2+3).
 * Stores profile, rating history, tournaments, and games.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  PlayerProfile,
  RatingEntry,
  TournamentEntry,
  GameEntry,
} from "@/lib/scrapers/chess-org-il";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Complete player data including Tier 1, 2, and 3 data.
 */
export interface DeepPlayerData {
  profile: PlayerProfile;
  ratingHistory: RatingEntry[];
  tournaments: TournamentEntry[];
  games: GameEntry[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(israeliId: number): string {
  return path.join(CACHE_DIR, `player-${israeliId}-deep.json`);
}

/**
 * Retrieve cached deep player data if it exists and is not expired.
 * @param israeliId Israeli chess federation player ID
 * @param ttlMs Time-to-live in milliseconds (default: 24 hours)
 * @returns DeepPlayerData or null if not cached or expired
 */
export function getCachedPlayerDeep(
  israeliId: number,
  ttlMs = DEFAULT_TTL_MS
): DeepPlayerData | null {
  const filePath = cacheFilePath(israeliId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry: CacheEntry<DeepPlayerData> = JSON.parse(raw);

    // Check TTL expiry
    if (Date.now() - entry.timestamp > ttlMs) return null;

    // Revive Date objects from JSON strings
    const data = entry.data;
    if (data.profile.cardValidUntil) {
      data.profile.cardValidUntil = new Date(data.profile.cardValidUntil);
    }
    for (const r of data.ratingHistory) {
      r.recordedAt = new Date(r.recordedAt);
    }
    for (const t of data.tournaments) {
      t.date = new Date(t.date);
      if (t.ratingUpdateDate) t.ratingUpdateDate = new Date(t.ratingUpdateDate);
    }
    for (const g of data.games) {
      g.date = new Date(g.date);
    }

    return data;
  } catch {
    // Handle corrupt/invalid files gracefully
    return null;
  }
}

/**
 * Cache deep player data to disk.
 * @param israeliId Israeli chess federation player ID
 * @param data Deep player data to cache
 */
export function setCachedPlayerDeep(israeliId: number, data: DeepPlayerData): void {
  ensureCacheDir();
  const entry: CacheEntry<DeepPlayerData> = { data, timestamp: Date.now() };
  fs.writeFileSync(cacheFilePath(israeliId), JSON.stringify(entry, null, 2));
}

/**
 * Get the age of cached data in milliseconds.
 * @param israeliId Israeli chess federation player ID
 * @returns Age in ms, or null if not cached
 */
export function getPlayerCacheAge(israeliId: number): number | null {
  const filePath = cacheFilePath(israeliId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
}

/**
 * Check if cached data exists (regardless of TTL).
 * @param israeliId Israeli chess federation player ID
 * @returns true if cache file exists
 */
export function hasPlayerCache(israeliId: number): boolean {
  return fs.existsSync(cacheFilePath(israeliId));
}

/**
 * Delete cached data for a player.
 * @param israeliId Israeli chess federation player ID
 */
export function clearPlayerCache(israeliId: number): void {
  const filePath = cacheFilePath(israeliId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * List all cached player IDs.
 * @returns Array of Israeli IDs that have cached data
 */
export function listCachedPlayerIds(): number[] {
  if (!fs.existsSync(CACHE_DIR)) return [];

  const files = fs.readdirSync(CACHE_DIR);
  const ids: number[] = [];

  for (const file of files) {
    const match = file.match(/^player-(\d+)-deep\.json$/);
    if (match) {
      ids.push(parseInt(match[1], 10));
    }
  }

  return ids;
}
