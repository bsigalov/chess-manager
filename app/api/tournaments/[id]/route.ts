import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buchholz, sonnebornBerger } from "@/lib/analytics/tiebreaks";
import type { CrosstableEntry } from "@/lib/types/tournament";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        players: {
          include: { player: true },
          orderBy: { currentRank: "asc" },
        },
        pairings: {
          include: {
            whitePlayer: true,
            blackPlayer: true,
          },
          orderBy: [{ round: "asc" }, { board: "asc" }],
        },
      },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Load crosstable from metadata for tiebreak computation
    const metadata = tournament.metadata as Record<string, unknown> | null;
    const crosstable = (metadata?.crosstable as CrosstableEntry[] | undefined) ?? null;

    // Build tiebreak lookup if crosstable is available
    const tiebreakMap = new Map<number, { buchholz: number; sonnebornBerger: number }>();
    if (crosstable && crosstable.length > 0) {
      for (const entry of crosstable) {
        try {
          tiebreakMap.set(entry.startingRank, {
            buchholz: buchholz(entry.startingRank, crosstable),
            sonnebornBerger: sonnebornBerger(entry.startingRank, crosstable),
          });
        } catch {
          // Skip if tiebreak computation fails for a player
        }
      }
    }

    // Build standings from tournament players
    const standings = tournament.players
      .map((tp) => {
        const rank = tp.currentRank ?? tp.startingRank ?? 0;
        const startingRank = tp.startingRank ?? 0;
        const tb = tiebreakMap.get(startingRank);
        return {
          playerId: tp.playerId,
          rank,
          name: tp.player.name,
          title: tp.player.title,
          rating: tp.startingRating ?? tp.player.rating,
          federation: tp.player.country,
          points: tp.points,
          performance: tp.performance,
          buchholz: tb?.buchholz ?? null,
          sonnebornBerger: tb?.sonnebornBerger ?? null,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.rank - b.rank;
      });

    // Group pairings by round
    const pairingsByRound: Record<
      number,
      {
        pairingId: string;
        board: number;
        whitePlayerId: string | null;
        blackPlayerId: string | null;
        whiteName: string;
        whiteTitle: string | null;
        blackName: string;
        blackTitle: string | null;
        whiteRating: number | null;
        blackRating: number | null;
        result: string | null;
      }[]
    > = {};
    for (const p of tournament.pairings) {
      if (!pairingsByRound[p.round]) pairingsByRound[p.round] = [];
      pairingsByRound[p.round].push({
        pairingId: p.id,
        board: p.board,
        whitePlayerId: p.whitePlayerId,
        blackPlayerId: p.blackPlayerId,
        whiteName: p.whitePlayer?.name ?? "BYE",
        whiteTitle: p.whitePlayer?.title ?? null,
        blackName: p.blackPlayer?.name ?? "BYE",
        blackTitle: p.blackPlayer?.title ?? null,
        whiteRating: p.whiteElo ?? p.whitePlayer?.rating ?? null,
        blackRating: p.blackElo ?? p.blackPlayer?.rating ?? null,
        result: p.result,
      });
    }

    return NextResponse.json({
      id: tournament.id,
      name: tournament.name,
      venue: tournament.venue,
      city: tournament.city,
      country: tournament.country,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      rounds: tournament.rounds,
      currentRound: tournament.currentRound,
      status: tournament.status,
      playerCount: tournament.players.length,
      standings,
      pairings: pairingsByRound,
    });
  } catch (error) {
    console.error("Tournament detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournament" },
      { status: 500 }
    );
  }
}
