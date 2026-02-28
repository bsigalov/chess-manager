/**
 * GET /api/players/analytics-compare
 *
 * Resolve a comparison group and return analytics for each player.
 *
 * Query params:
 * - primaryId: Israeli ID of the primary player
 * - filter: club | age | experience | opponents | tournament
 * - filterValue: (optional) specific value for tournament filter
 */

import { NextRequest, NextResponse } from "next/server";
import { getCachedPlayerDeep } from "@/lib/cache/player-cache";
import { getCachedClubData } from "@/lib/cache/club-cache";
import { computeFullAnalytics, type PlayerAnalytics } from "@/lib/analytics/player-analytics";
import type { DeepPlayerData } from "@/lib/cache/player-cache";
import type { RatingEntry } from "@/lib/scrapers/chess-org-il";

type FilterType = "club" | "age" | "experience" | "opponents" | "tournament";

// Club cache data structure
interface ClubPlayerData {
  israeliId: number;
  name: string;
  birthYear?: number;
  rating: number;
  fideRating?: number;
  ratingHistory: RatingEntry[];
}

interface ClubCacheData {
  clubName: string;
  players: ClubPlayerData[];
}

interface ComparisonPlayer {
  israeliId: number;
  name: string;
  rating: number;
  analytics: PlayerAnalytics;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const primaryIdStr = searchParams.get("primaryId");
    const filter = searchParams.get("filter") as FilterType | null;
    const filterValue = searchParams.get("filterValue");

    if (!primaryIdStr) {
      return NextResponse.json(
        { error: "primaryId is required" },
        { status: 400 }
      );
    }

    const primaryId = parseInt(primaryIdStr, 10);
    if (isNaN(primaryId)) {
      return NextResponse.json(
        { error: "Invalid primaryId" },
        { status: 400 }
      );
    }

    // Load primary player data
    const primaryData = getPlayerData(primaryId);
    if (!primaryData) {
      return NextResponse.json(
        { error: "Primary player not found in cache" },
        { status: 404 }
      );
    }

    const primaryAnalytics = computeFullAnalytics(primaryData);

    // Resolve comparison group based on filter
    let comparisonPlayers: ComparisonPlayer[] = [];

    if (filter) {
      const playerIds = resolveComparisonGroup(primaryId, primaryData, filter, filterValue);
      comparisonPlayers = playerIds
        .filter((id) => id !== primaryId) // Exclude primary player
        .map((id) => {
          const data = getPlayerData(id);
          if (!data) return null;
          return {
            israeliId: id,
            name: data.profile.name,
            rating: data.profile.israeliRating,
            analytics: computeFullAnalytics(data),
          };
        })
        .filter((p): p is ComparisonPlayer => p !== null);
    }

    return NextResponse.json({
      primary: {
        israeliId: primaryId,
        name: primaryData.profile.name,
        rating: primaryData.profile.israeliRating,
        analytics: primaryAnalytics,
      },
      comparisons: comparisonPlayers,
    });
  } catch (error) {
    console.error("Analytics comparison API error:", error);
    return NextResponse.json(
      { error: "Failed to compute comparison" },
      { status: 500 }
    );
  }
}

/**
 * Get player data from deep cache or club cache.
 */
function getPlayerData(israeliId: number): DeepPlayerData | null {
  // Try deep cache first
  const deepData = getCachedPlayerDeep(israeliId);
  if (deepData) return deepData;

  // Fall back to club cache
  const clubData = findPlayerInClubCache(israeliId);
  if (clubData) {
    return {
      profile: {
        israeliId,
        name: clubData.name,
        israeliRating: clubData.rating,
        birthYear: clubData.birthYear,
        fideRatingStandard: clubData.fideRating,
      },
      ratingHistory: clubData.ratingHistory,
      tournaments: [],
      games: [],
    };
  }

  return null;
}

/**
 * Search all club caches for a player by their Israeli ID.
 */
function findPlayerInClubCache(israeliId: number): ClubPlayerData | null {
  const clubIds = ["155"]; // צפריר הובר רחובות

  for (const clubId of clubIds) {
    const clubData = getCachedClubData<ClubCacheData>(clubId);
    if (!clubData) continue;

    const player = clubData.players.find((p) => p.israeliId === israeliId);
    if (player) return player;
  }

  return null;
}

/**
 * Resolve comparison group based on filter type.
 */
function resolveComparisonGroup(
  primaryId: number,
  primaryData: DeepPlayerData,
  filter: FilterType,
  filterValue?: string | null
): number[] {
  switch (filter) {
    case "club":
      return resolveClubComparison();

    case "age":
      return resolveAgeComparison(primaryData.profile.birthYear);

    case "experience":
      return resolveExperienceComparison(primaryData.ratingHistory.length);

    case "opponents":
      return resolveOpponentsComparison(primaryData);

    case "tournament":
      // Would require tournament lookup - for now return empty
      return [];

    default:
      return [];
  }
}

/**
 * Get all players from the same club.
 */
function resolveClubComparison(): number[] {
  const clubIds = ["155"];
  const playerIds: number[] = [];

  for (const clubId of clubIds) {
    const clubData = getCachedClubData<ClubCacheData>(clubId);
    if (clubData) {
      for (const player of clubData.players) {
        playerIds.push(player.israeliId);
      }
    }
  }

  return playerIds;
}

/**
 * Get players with similar age (±2 years).
 */
function resolveAgeComparison(birthYear?: number): number[] {
  if (!birthYear) return [];

  const clubIds = ["155"];
  const playerIds: number[] = [];

  for (const clubId of clubIds) {
    const clubData = getCachedClubData<ClubCacheData>(clubId);
    if (clubData) {
      for (const player of clubData.players) {
        if (player.birthYear) {
          const ageDiff = Math.abs(player.birthYear - birthYear);
          if (ageDiff <= 2) {
            playerIds.push(player.israeliId);
          }
        }
      }
    }
  }

  return playerIds;
}

/**
 * Get players with similar rating history length (experience).
 */
function resolveExperienceComparison(historyLength: number): number[] {
  const clubIds = ["155"];
  const playerIds: number[] = [];
  const tolerance = Math.max(5, Math.floor(historyLength * 0.25)); // ±25%

  for (const clubId of clubIds) {
    const clubData = getCachedClubData<ClubCacheData>(clubId);
    if (clubData) {
      for (const player of clubData.players) {
        const len = player.ratingHistory?.length || 0;
        if (Math.abs(len - historyLength) <= tolerance) {
          playerIds.push(player.israeliId);
        }
      }
    }
  }

  return playerIds;
}

/**
 * Get players who appear as opponents in the primary player's game history.
 */
function resolveOpponentsComparison(data: DeepPlayerData): number[] {
  const opponentIds = new Set<number>();

  for (const game of data.games) {
    if (game.opponentIsraeliId) {
      opponentIds.add(game.opponentIsraeliId);
    }
  }

  return Array.from(opponentIds);
}
