import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseBaseUrl,
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
  scrapeStandings,
  StandingsEntry,
} from "@/lib/scrapers/chess-results";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Try using the new import pipeline
    try {
      const { createImportJob, processImportJob } = await import(
        "@/lib/import/import-service"
      );
      const { startSyncLog, completeSyncLog, failSyncLog } = await import(
        "@/lib/data-quality/sync-logger"
      );
      const { captureSnapshot } = await import(
        "@/lib/data-quality/snapshot-service"
      );

      const syncLogId = await startSyncLog(id, "full_scrape");

      try {
        const jobId = await createImportJob({
          sourceType: tournament.sourceType as "chess-results",
          url: tournament.sourceUrl,
        });
        await processImportJob(jobId);
        const job = await prisma.importJob.findUnique({ where: { id: jobId } });

        if (job?.status === "completed") {
          // Capture snapshot of current round
          const updated = await prisma.tournament.findUnique({
            where: { id: id },
          });
          if (updated?.currentRound) {
            await captureSnapshot(id, updated.currentRound).catch(() => {});
          }
          await completeSyncLog(syncLogId, job.resultData as Record<string, unknown> ?? {});
          return NextResponse.json({ success: true });
        }

        await failSyncLog(syncLogId, job?.error ?? "Unknown error");
        return NextResponse.json(
          { error: job?.error ?? "Refresh failed" },
          { status: 500 }
        );
      } catch (err) {
        await failSyncLog(syncLogId, String(err));
        throw err;
      }
    } catch {
      // Fallback to legacy refresh
      return legacyRefresh(id, tournament.externalId, tournament.sourceUrl);
    }
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tournament" },
      { status: 500 }
    );
  }
}

async function legacyRefresh(id: string, externalId: string, sourceUrl: string) {
  const baseUrl = parseBaseUrl(sourceUrl);
  const info = await scrapeTournamentInfo(externalId, baseUrl);
  const playerList = await scrapePlayerList(externalId, baseUrl);

  // Scrape standings for points/rank data
  let standings: StandingsEntry[] = [];
  try {
    standings = await scrapeStandings(externalId, undefined, baseUrl);
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

  const standingsByName = new Map<string, StandingsEntry>();
  for (const s of standings) {
    standingsByName.set(s.name, s);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tournament.update({
      where: { id },
      data: {
        name: info.name,
        rounds: totalRounds,
        currentRound,
        status: currentRound >= totalRounds && totalRounds > 0 ? "completed" : info.status,
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
          update: { rating: p.rating },
        });
      } else {
        player = await tx.player.findFirst({
          where: { name: p.name, country: p.federation },
        });
        if (!player) {
          player = await tx.player.create({
            data: {
              name: p.name,
              title: p.title,
              rating: p.rating,
              country: p.federation,
            },
          });
        }
      }

      const standing = standingsByName.get(p.name);
      await tx.tournamentPlayer.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId: id,
            playerId: player.id,
          },
        },
        create: {
          tournamentId: id,
          playerId: player.id,
          startingRank: p.startingRank,
          startingRating: p.rating,
          currentRank: standing?.rank ?? null,
          points: standing?.points ?? 0,
          performance: standing?.performance ?? null,
          gamesPlayed: standing?.gamesPlayed ?? 0,
        },
        update: {
          startingRating: p.rating,
          currentRank: standing?.rank ?? undefined,
          points: standing?.points ?? undefined,
          performance: standing?.performance ?? undefined,
          gamesPlayed: standing?.gamesPlayed ?? undefined,
        },
      });
    }

    await tx.pairing.deleteMany({ where: { tournamentId: id } });

    for (let round = 1; round <= currentRound; round++) {
      const pairings = await scrapePairings(externalId, round, baseUrl);
      for (const pairing of pairings) {
        const white = await tx.player.findFirst({
          where: { name: { contains: pairing.whiteName } },
        });
        const black = await tx.player.findFirst({
          where: { name: { contains: pairing.blackName } },
        });

        await tx.pairing.create({
          data: {
            tournamentId: id,
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
  });

  return NextResponse.json({ success: true });
}
