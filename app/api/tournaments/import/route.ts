import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseTournamentUrl,
  parseBaseUrl,
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
  scrapeStandings,
  StandingsEntry,
} from "@/lib/scrapers/chess-results";
import type { ImportInput } from "@/lib/providers/types";

/**
 * POST /api/tournaments/import
 *
 * Legacy synchronous import endpoint.
 * Kept for backward compatibility — new code should use POST /api/import/url.
 *
 * Accepts: { url: string }
 * Returns: { id: string, alreadyExists?: boolean } or { jobId: string } for async
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Try the new async pipeline first
    try {
      const { createImportJob, processImportJob } = await import(
        "@/lib/import/import-service"
      );

      const sourceType = detectSourceType(url);
      const input: ImportInput = { sourceType, url };
      const jobId = await createImportJob(input);

      // Process synchronously for backward compatibility (returns tournament ID)
      await processImportJob(jobId);
      const job = await prisma.importJob.findUnique({ where: { id: jobId } });

      if (job?.status === "completed" && job.resultData) {
        const result = job.resultData as { tournamentId?: string; created?: boolean };
        return NextResponse.json({
          id: result.tournamentId,
          alreadyExists: !result.created,
        });
      }
      if (job?.status === "failed") {
        return NextResponse.json({ error: job.error || "Import failed" }, { status: 500 });
      }

      return NextResponse.json({ jobId });
    } catch {
      // Fallback to legacy direct import if new pipeline not ready
      return legacyImport(url);
    }
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import tournament" },
      { status: 500 }
    );
  }
}

function detectSourceType(url: string): ImportInput["sourceType"] {
  if (url.includes("chess-results.com")) return "chess-results";
  if (url.includes("lichess.org")) return "lichess";
  if (url.includes("chess.com")) return "chesscom";
  return "chess-results";
}

async function legacyImport(url: string) {
  let tournamentId: string;
  try {
    tournamentId = parseTournamentUrl(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid chess-results.com URL" },
      { status: 400 }
    );
  }

  const existing = await prisma.tournament.findUnique({
    where: { externalId: tournamentId },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, alreadyExists: true });
  }

  const baseUrl = parseBaseUrl(url);
  const info = await scrapeTournamentInfo(tournamentId, baseUrl);
  const playerList = await scrapePlayerList(tournamentId, baseUrl);

  // Scrape standings for points/rank data
  let standings: StandingsEntry[] = [];
  try {
    standings = await scrapeStandings(tournamentId, undefined, baseUrl);
  } catch {
    // Standings may not be available yet
  }

  // Resolve round count — info page often returns 0
  let totalRounds = info.rounds;
  let currentRound = info.currentRound;
  if (totalRounds === 0 && standings.length > 0 && standings[0].gamesPlayed) {
    totalRounds = standings[0].gamesPlayed;
    currentRound = totalRounds;
  }

  // Build lookup for standings by player name
  const standingsByName = new Map<string, StandingsEntry>();
  for (const s of standings) {
    standingsByName.set(s.name, s);
  }

  const tournament = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.create({
      data: {
        externalId: tournamentId,
        name: info.name,
        venue: info.venue,
        city: info.city,
        country: info.country,
        startDate: info.startDate ? new Date(info.startDate) : new Date(),
        endDate: info.endDate ? new Date(info.endDate) : new Date(),
        rounds: totalRounds,
        currentRound,
        timeControl: info.timeControl,
        tournamentType: info.tournamentType,
        status: currentRound >= totalRounds && totalRounds > 0 ? "completed" : info.status,
        sourceUrl: url,
        lastScrapedAt: new Date(),
      },
    });

    for (const p of playerList) {
      let player;
      if (p.fideId) {
        player = await tx.player.upsert({
          where: { fideId: p.fideId },
          create: {
            fideId: p.fideId,
            name: p.name,
            title: p.title,
            rating: p.rating,
            country: p.federation,
          },
          update: {
            name: p.name,
            title: p.title,
            rating: p.rating,
            country: p.federation,
          },
        });
      } else {
        // Create new player without fake FIDE ID
        player = await tx.player.create({
          data: {
            name: p.name,
            title: p.title,
            rating: p.rating,
            country: p.federation,
          },
        });
      }

      const standing = standingsByName.get(p.name);
      await tx.tournamentPlayer.create({
        data: {
          tournamentId: t.id,
          playerId: player.id,
          startingRank: p.startingRank,
          startingRating: p.rating,
          currentRank: standing?.rank ?? null,
          points: standing?.points ?? 0,
          performance: standing?.performance ?? null,
          gamesPlayed: standing?.gamesPlayed ?? 0,
        },
      });
    }

    for (let round = 1; round <= currentRound; round++) {
      const pairings = await scrapePairings(tournamentId, round, baseUrl);
      for (const pairing of pairings) {
        const white = await tx.player.findFirst({
          where: { name: { contains: pairing.whiteName } },
        });
        const black = await tx.player.findFirst({
          where: { name: { contains: pairing.blackName } },
        });

        await tx.pairing.create({
          data: {
            tournamentId: t.id,
            round,
            board: pairing.board,
            whitePlayerId: white?.id || null,
            blackPlayerId: black?.id || null,
            result: pairing.result,
            whiteElo: pairing.whiteRating,
            blackElo: pairing.blackRating,
          },
        });
      }
    }

    return t;
  });

  return NextResponse.json({ id: tournament.id });
}
