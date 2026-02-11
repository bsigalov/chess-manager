import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
} from "@/lib/scrapers/chess-results";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
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

      const syncLogId = await startSyncLog(params.id, "full_scrape");

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
            where: { id: params.id },
          });
          if (updated?.currentRound) {
            await captureSnapshot(params.id, updated.currentRound).catch(() => {});
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
      return legacyRefresh(params.id, tournament.externalId);
    }
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh tournament" },
      { status: 500 }
    );
  }
}

async function legacyRefresh(id: string, externalId: string) {
  const info = await scrapeTournamentInfo(externalId);
  const playerList = await scrapePlayerList(externalId);

  await prisma.$transaction(async (tx) => {
    await tx.tournament.update({
      where: { id },
      data: {
        name: info.name,
        currentRound: info.currentRound,
        status: info.status,
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
        },
        update: { startingRating: p.rating },
      });
    }

    await tx.pairing.deleteMany({ where: { tournamentId: id } });

    for (let round = 1; round <= info.currentRound; round++) {
      const pairings = await scrapePairings(externalId, round);
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
          },
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}
