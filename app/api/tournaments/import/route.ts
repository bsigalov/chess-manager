import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseTournamentUrl,
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
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

  const info = await scrapeTournamentInfo(tournamentId);
  const playerList = await scrapePlayerList(tournamentId);

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
        rounds: info.rounds,
        currentRound: info.currentRound,
        timeControl: info.timeControl,
        tournamentType: info.tournamentType,
        status: info.status,
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

      await tx.tournamentPlayer.create({
        data: {
          tournamentId: t.id,
          playerId: player.id,
          startingRank: p.startingRank,
          startingRating: p.rating,
        },
      });
    }

    for (let round = 1; round <= info.currentRound; round++) {
      const pairings = await scrapePairings(tournamentId, round);
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
          },
        });
      }
    }

    return t;
  });

  return NextResponse.json({ id: tournament.id });
}
