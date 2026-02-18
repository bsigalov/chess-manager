import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const player1 = searchParams.get("player1");
    const player2 = searchParams.get("player2");

    if (!player1 || !player2) {
      return NextResponse.json(
        { error: "Both player1 and player2 query params required" },
        { status: 400 }
      );
    }

    // Fetch both players
    const [p1, p2] = await Promise.all([
      prisma.player.findUnique({
        where: { id: player1 },
        select: { id: true, name: true, title: true, rating: true },
      }),
      prisma.player.findUnique({
        where: { id: player2 },
        select: { id: true, name: true, title: true, rating: true },
      }),
    ]);

    if (!p1 || !p2) {
      return NextResponse.json(
        { error: "One or both players not found" },
        { status: 404 }
      );
    }

    // Find all pairings between them
    const pairings = await prisma.pairing.findMany({
      where: {
        OR: [
          { whitePlayerId: player1, blackPlayerId: player2 },
          { whitePlayerId: player2, blackPlayerId: player1 },
        ],
      },
      include: {
        tournament: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;

    const games = pairings.map((p) => {
      const p1IsWhite = p.whitePlayerId === player1;

      if (p.result === "1-0") {
        p1IsWhite ? p1Wins++ : p2Wins++;
      } else if (p.result === "0-1") {
        p1IsWhite ? p2Wins++ : p1Wins++;
      } else if (p.result === "1/2-1/2") {
        draws++;
      }

      return {
        pairingId: p.id,
        tournamentId: p.tournament.id,
        tournamentName: p.tournament.name,
        round: p.round,
        board: p.board,
        p1Color: p1IsWhite ? "white" : "black",
        result: p.result,
        whiteElo: p.whiteElo,
        blackElo: p.blackElo,
      };
    });

    return NextResponse.json({
      player1: p1,
      player2: p2,
      summary: { p1Wins, p2Wins, draws, total: pairings.length },
      games,
    });
  } catch (error) {
    console.error("Player compare error:", error);
    return NextResponse.json(
      { error: "Failed to compare players" },
      { status: 500 }
    );
  }
}
