import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  CookieSession,
  scrapePlayerProfile,
  scrapePlayerTournaments,
  scrapePlayerRatingHistory,
  scrapePlayerGames,
  isActivePlayer,
} from "@/lib/scrapers/chess-org-il";

const HISTORY_CUTOFF = new Date("2016-01-01");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const withGames = searchParams.get("withGames") === "true";

  // Find player in DB
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const metadata = player.metadata as Record<string, unknown> | null;
  const israeliId = metadata?.israeliId as number | undefined;
  if (!israeliId) {
    return NextResponse.json(
      { error: "Player has no israeliId in metadata — not an Israeli player" },
      { status: 400 }
    );
  }

  const session = new CookieSession();

  try {
    // Scrape fresh data
    const profile = await scrapePlayerProfile(session, israeliId);

    if (!isActivePlayer(profile)) {
      return NextResponse.json(
        { error: "Player card is expired or missing" },
        { status: 422 }
      );
    }

    const tournaments = await scrapePlayerTournaments(session, israeliId, HISTORY_CUTOFF);
    const ratingHistory = await scrapePlayerRatingHistory(session, israeliId);

    let gamesCount = 0;
    if (withGames) {
      const games = await scrapePlayerGames(session, israeliId, HISTORY_CUTOFF);
      gamesCount = games.length;
      // Game storage not yet fully implemented — log for now
      console.log(`[refresh-israel] ${games.length} games scraped for player ${id}`);
    }

    // Upsert in transaction
    await prisma.$transaction(async (tx) => {
      const metadataPayload = JSON.parse(JSON.stringify({
        israeliId: profile.israeliId,
        israeliRating: profile.israeliRating,
        israeliRank: profile.israeliRank,
        cardValidUntil: profile.cardValidUntil?.toISOString(),
        club: profile.club,
        source: "chess-org-il",
      }));

      await tx.player.update({
        where: { id },
        data: {
          name: profile.name,
          fideId: profile.fideId ?? player.fideId,
          rating: profile.israeliRating,
          birthYear: profile.birthYear ?? player.birthYear,
          country: "ISR",
          isActive: true,
          metadata: metadataPayload,
        },
      });

      // Refresh rating history
      if (ratingHistory.length > 0) {
        await tx.ratingHistory.deleteMany({
          where: { playerId: id, ratingType: "israeli" },
        });
        await tx.ratingHistory.createMany({
          data: ratingHistory.map((e) => ({
            playerId: id,
            ratingType: "israeli",
            rating: e.rating,
            source: "chess-org-il",
            recordedAt: e.recordedAt,
          })),
        });
      }
    });

    return NextResponse.json({
      updated: true,
      ratingPoints: ratingHistory.length,
      tournaments: tournaments.length,
      ...(withGames && { games: gamesCount }),
    });
  } catch (err) {
    console.error(`[refresh-israel] Error for player ${id}:`, err);
    return NextResponse.json(
      { error: "Scraping failed", details: String(err) },
      { status: 500 }
    );
  }
}
