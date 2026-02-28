/**
 * POST /api/players/[id]/deep-scrape
 *
 * Trigger deep scraping of a player's tournaments and games from chess.org.il.
 * Caches result in `.cache/player-{id}-deep.json`.
 *
 * Body: { depth: "tournaments" | "games" | "full" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCachedPlayerDeep, setCachedPlayerDeep } from "@/lib/cache/player-cache";
import {
  CookieSession,
  scrapePlayerProfile,
  scrapePlayerTournaments,
  scrapePlayerRatingHistory,
  scrapePlayerGames,
} from "@/lib/scrapers/chess-org-il";
import type { DeepPlayerData } from "@/lib/cache/player-cache";

export async function POST(
  request: NextRequest,
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

    // Parse request body
    let depth: "tournaments" | "games" | "full" = "full";
    try {
      const body = await request.json();
      if (body.depth && ["tournaments", "games", "full"].includes(body.depth)) {
        depth = body.depth;
      }
    } catch {
      // Use default depth if body is empty or invalid
    }

    // Try to load existing cached data (to preserve what we have)
    let existingData = getCachedPlayerDeep(israeliId);

    // Create session for scraping
    const session = new CookieSession();

    // Cutoff date for tournament/game history (2 years)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    // Always scrape profile and rating history
    const profile = await scrapePlayerProfile(session, israeliId);
    const ratingHistory = await scrapePlayerRatingHistory(session, israeliId);

    // Initialize data structure
    const data: DeepPlayerData = {
      profile,
      ratingHistory,
      tournaments: existingData?.tournaments || [],
      games: existingData?.games || [],
    };

    // Scrape tournaments if requested
    if (depth === "tournaments" || depth === "full") {
      data.tournaments = await scrapePlayerTournaments(
        session,
        israeliId,
        cutoffDate
      );
    }

    // Scrape games if requested
    if (depth === "games" || depth === "full") {
      data.games = await scrapePlayerGames(session, israeliId, cutoffDate);
    }

    // Cache the result
    setCachedPlayerDeep(israeliId, data);

    return NextResponse.json({
      status: "complete",
      israeliId,
      depth,
      profile: data.profile,
      ratingHistoryCount: data.ratingHistory.length,
      tournamentsCount: data.tournaments.length,
      gamesCount: data.games.length,
    });
  } catch (error) {
    console.error("Deep scrape error:", error);
    return NextResponse.json(
      { error: "Failed to scrape player data" },
      { status: 500 }
    );
  }
}
