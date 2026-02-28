/**
 * GET /api/players/[id]/analytics
 *
 * Compute and return player analytics from cached deep data.
 * Falls back to club cache for rating history if no deep data available.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCachedPlayerDeep } from "@/lib/cache/player-cache";
import { getCachedClubData } from "@/lib/cache/club-cache";
import { computeFullAnalytics } from "@/lib/analytics/player-analytics";
import type { DeepPlayerData } from "@/lib/cache/player-cache";
import type {
  PlayerProfile,
  RatingEntry,
} from "@/lib/scrapers/chess-org-il";

// Club cache data structure (same as used in /api/clubs/[clubId]/players)
interface ClubCacheData {
  clubName: string;
  players: Array<{
    israeliId: number;
    name: string;
    birthYear?: number;
    rating: number;
    fideRating?: number;
    ratingHistory: RatingEntry[];
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const israeliId = parseInt(id, 10);

    if (isNaN(israeliId)) {
      return NextResponse.json(
        { error: "Invalid player ID" },
        { status: 400 }
      );
    }

    // Try to load deep cached data first
    let deepData = getCachedPlayerDeep(israeliId);
    let hasDeepData = !!deepData;

    // If no deep data, try to find player in club cache
    if (!deepData) {
      const clubData = findPlayerInClubCache(israeliId);
      if (clubData) {
        // Create minimal DeepPlayerData from club cache
        deepData = {
          profile: {
            israeliId,
            name: clubData.name,
            israeliRating: clubData.rating,
            birthYear: clubData.birthYear,
            fideRatingStandard: clubData.fideRating,
          },
          ratingHistory: clubData.ratingHistory || [],
          tournaments: [],
          games: [],
        };
      }
    }

    if (!deepData) {
      return NextResponse.json(
        { error: "Player not found in cache. Try importing from club first." },
        { status: 404 }
      );
    }

    // Compute analytics
    const analytics = computeFullAnalytics(deepData);

    return NextResponse.json({
      profile: deepData.profile,
      analytics,
      ratingHistory: deepData.ratingHistory,
      hasDeepData,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}

/**
 * Search all club caches for a player by their Israeli ID.
 */
function findPlayerInClubCache(israeliId: number): {
  name: string;
  rating: number;
  birthYear?: number;
  fideRating?: number;
  ratingHistory: RatingEntry[];
} | null {
  // Check known club IDs (can be expanded)
  const clubIds = ["155"]; // צפריר הובר רחובות

  for (const clubId of clubIds) {
    const clubData = getCachedClubData<ClubCacheData>(clubId);
    if (!clubData) continue;

    const player = clubData.players.find((p) => p.israeliId === israeliId);
    if (player) {
      return {
        name: player.name,
        rating: player.rating,
        birthYear: player.birthYear,
        fideRating: player.fideRating,
        ratingHistory: player.ratingHistory,
      };
    }
  }

  return null;
}
