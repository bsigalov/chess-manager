import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
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

    // Build standings from tournament players
    const standings = tournament.players
      .map((tp) => ({
        rank: tp.currentRank ?? tp.startingRank ?? 0,
        name: tp.player.name,
        title: tp.player.title,
        rating: tp.startingRating ?? tp.player.rating,
        federation: tp.player.country,
        points: tp.points,
        performance: tp.performance,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.rank - b.rank;
      });

    // Group pairings by round
    const pairingsByRound: Record<
      number,
      {
        board: number;
        whiteName: string;
        blackName: string;
        whiteRating: number | null;
        blackRating: number | null;
        result: string | null;
      }[]
    > = {};
    for (const p of tournament.pairings) {
      if (!pairingsByRound[p.round]) pairingsByRound[p.round] = [];
      pairingsByRound[p.round].push({
        board: p.board,
        whiteName: p.whitePlayer?.name ?? "BYE",
        blackName: p.blackPlayer?.name ?? "BYE",
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
