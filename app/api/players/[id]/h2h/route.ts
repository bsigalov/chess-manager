import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/players/[id]/h2h
 *
 * Returns head-to-head records for a player against all opponents
 * across ALL tournaments, not just a single one.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Find all pairings where this player participated (as white or black)
    const pairings = await prisma.pairing.findMany({
      where: {
        OR: [{ whitePlayerId: id }, { blackPlayerId: id }],
      },
      select: {
        round: true,
        result: true,
        whitePlayerId: true,
        blackPlayerId: true,
        whitePlayer: { select: { id: true, name: true, rating: true } },
        blackPlayer: { select: { id: true, name: true, rating: true } },
        tournament: { select: { id: true, name: true } },
      },
    });

    // Aggregate by opponent
    const byOpponent = new Map<
      string,
      {
        opponentId: string;
        opponentName: string;
        opponentRating: number | null;
        wins: number;
        draws: number;
        losses: number;
        games: {
          tournamentId: string;
          tournamentName: string;
          round: number;
          result: number; // from perspective of the queried player
          color: "white" | "black";
        }[];
      }
    >();

    for (const p of pairings) {
      const isWhite = p.whitePlayerId === id;
      const opponent = isWhite ? p.blackPlayer : p.whitePlayer;
      if (!opponent) continue; // bye

      const rawResult = p.result == null ? null : parseFloat(p.result);
      const result = rawResult == null || isNaN(rawResult) ? null : isWhite ? rawResult : 1 - rawResult;

      const rec = byOpponent.get(opponent.id) ?? {
        opponentId: opponent.id,
        opponentName: opponent.name,
        opponentRating: opponent.rating,
        wins: 0,
        draws: 0,
        losses: 0,
        games: [],
      };

      if (result === 1) rec.wins++;
      else if (result === 0.5) rec.draws++;
      else if (result === 0) rec.losses++;

      rec.games.push({
        tournamentId: p.tournament.id,
        tournamentName: p.tournament.name,
        round: p.round,
        result: result ?? 0,
        color: isWhite ? "white" : "black",
      });

      // Update rating to latest
      if (opponent.rating != null) rec.opponentRating = opponent.rating;

      byOpponent.set(opponent.id, rec);
    }

    const opponents = [...byOpponent.values()].sort(
      (a, b) => (b.opponentRating ?? 0) - (a.opponentRating ?? 0)
    );

    return NextResponse.json({ opponents });
  } catch (error) {
    console.error("H2H error:", error);
    return NextResponse.json({ error: "Failed to fetch H2H data" }, { status: 500 });
  }
}
