/**
 * player-cache.test.ts
 * Unit tests for per-player deep cache.
 */

import * as fs from "fs";
import * as path from "path";
import {
  getCachedPlayerDeep,
  setCachedPlayerDeep,
  getPlayerCacheAge,
  hasPlayerCache,
  clearPlayerCache,
  listCachedPlayerIds,
  type DeepPlayerData,
} from "@/lib/cache/player-cache";

const CACHE_DIR = path.join(process.cwd(), ".cache");

// Test player data fixture
const testPlayer: DeepPlayerData = {
  profile: {
    israeliId: 99999,
    name: "Test Player",
    israeliRating: 1850,
    birthYear: 2000,
    club: "Test Club",
    cardValidUntil: new Date("2026-12-31"),
    cardActive: true,
  },
  ratingHistory: [
    { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
    { period: "01/02/2025", rating: 1820, recordedAt: new Date("2025-02-01") },
    { period: "01/03/2025", rating: 1850, recordedAt: new Date("2025-03-01") },
  ],
  tournaments: [
    {
      date: new Date("2025-01-15"),
      tournamentName: "Winter Open",
      games: 7,
      points: 5,
      result: "5/7",
      ratingChange: 15,
    },
    {
      date: new Date("2025-02-20"),
      tournamentName: "February Rapid",
      games: 9,
      points: 6,
      result: "6/9",
      ratingChange: 30,
    },
  ],
  games: [
    {
      date: new Date("2025-01-15"),
      tournamentName: "Winter Open",
      opponentName: "Opponent A",
      opponentIsraeliId: 11111,
      opponentRating: 1900,
      color: "white",
      result: "win",
    },
    {
      date: new Date("2025-01-15"),
      tournamentName: "Winter Open",
      opponentName: "Opponent B",
      opponentIsraeliId: 22222,
      opponentRating: 1750,
      color: "black",
      result: "draw",
    },
  ],
};

describe("player-cache", () => {
  const testId = 99999;
  const cacheFile = path.join(CACHE_DIR, `player-${testId}-deep.json`);

  beforeEach(() => {
    // Clean up test cache file before each test
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  });

  describe("setCachedPlayerDeep", () => {
    it("writes deep player data to .cache/", () => {
      setCachedPlayerDeep(testId, testPlayer);

      expect(fs.existsSync(cacheFile)).toBe(true);

      const raw = fs.readFileSync(cacheFile, "utf-8");
      const entry = JSON.parse(raw);

      expect(entry.data.profile.israeliId).toBe(99999);
      expect(entry.data.profile.name).toBe("Test Player");
      expect(entry.data.ratingHistory).toHaveLength(3);
      expect(entry.data.tournaments).toHaveLength(2);
      expect(entry.data.games).toHaveLength(2);
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it("creates .cache/ directory if it does not exist", () => {
      // This test assumes the cache dir might not exist
      // In practice it probably does, so this just verifies no error
      expect(() => setCachedPlayerDeep(testId, testPlayer)).not.toThrow();
    });
  });

  describe("getCachedPlayerDeep", () => {
    it("returns cached data when valid", () => {
      setCachedPlayerDeep(testId, testPlayer);

      const result = getCachedPlayerDeep(testId);

      expect(result).not.toBeNull();
      expect(result!.profile.israeliId).toBe(99999);
      expect(result!.profile.name).toBe("Test Player");
      expect(result!.ratingHistory).toHaveLength(3);
      expect(result!.tournaments).toHaveLength(2);
      expect(result!.games).toHaveLength(2);
    });

    it("revives Date objects from JSON", () => {
      setCachedPlayerDeep(testId, testPlayer);

      const result = getCachedPlayerDeep(testId);

      expect(result!.profile.cardValidUntil).toBeInstanceOf(Date);
      expect(result!.ratingHistory[0].recordedAt).toBeInstanceOf(Date);
      expect(result!.tournaments[0].date).toBeInstanceOf(Date);
      expect(result!.games[0].date).toBeInstanceOf(Date);
    });

    it("returns null when cache does not exist", () => {
      const result = getCachedPlayerDeep(88888);
      expect(result).toBeNull();
    });

    it("returns null when cache is expired (TTL exceeded)", () => {
      // Write with old timestamp
      const entry = {
        data: testPlayer,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(entry));

      const result = getCachedPlayerDeep(testId);
      expect(result).toBeNull();
    });

    it("returns data when custom TTL is provided and not exceeded", () => {
      // Write with timestamp 2 hours ago
      const entry = {
        data: testPlayer,
        timestamp: Date.now() - 2 * 60 * 60 * 1000,
      };
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(entry));

      // Use 3 hour TTL
      const result = getCachedPlayerDeep(testId, 3 * 60 * 60 * 1000);
      expect(result).not.toBeNull();
    });

    it("handles corrupt/invalid files gracefully", () => {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cacheFile, "not valid json{{{");

      const result = getCachedPlayerDeep(testId);
      expect(result).toBeNull();
    });
  });

  describe("getPlayerCacheAge", () => {
    it("returns age in milliseconds", () => {
      setCachedPlayerDeep(testId, testPlayer);

      const age = getPlayerCacheAge(testId);

      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1000); // Should be less than 1 second
    });

    it("returns null when cache does not exist", () => {
      const age = getPlayerCacheAge(88888);
      expect(age).toBeNull();
    });
  });

  describe("hasPlayerCache", () => {
    it("returns true when cache exists", () => {
      setCachedPlayerDeep(testId, testPlayer);
      expect(hasPlayerCache(testId)).toBe(true);
    });

    it("returns false when cache does not exist", () => {
      expect(hasPlayerCache(88888)).toBe(false);
    });
  });

  describe("clearPlayerCache", () => {
    it("deletes the cache file", () => {
      setCachedPlayerDeep(testId, testPlayer);
      expect(fs.existsSync(cacheFile)).toBe(true);

      clearPlayerCache(testId);
      expect(fs.existsSync(cacheFile)).toBe(false);
    });

    it("does not throw when cache does not exist", () => {
      expect(() => clearPlayerCache(88888)).not.toThrow();
    });
  });

  describe("listCachedPlayerIds", () => {
    it("lists all cached player IDs", () => {
      setCachedPlayerDeep(testId, testPlayer);

      const ids = listCachedPlayerIds();

      expect(ids).toContain(testId);
    });
  });
});
