import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const games = await prisma.game.findMany({
      where: {
        OR: [{ whitePlayerId: id }, { blackPlayerId: id }],
        ecoCode: { not: null },
      },
      select: {
        ecoCode: true,
        openingName: true,
        result: true,
        whitePlayerId: true,
        blackPlayerId: true,
      },
    });

    if (games.length === 0) {
      return NextResponse.json({ openings: [] });
    }

    // Group by ECO code
    const grouped = new Map<
      string,
      { ecoCode: string; openingName: string | null; wins: number; draws: number; losses: number; total: number }
    >();

    for (const g of games) {
      const eco = g.ecoCode!;
      if (!grouped.has(eco)) {
        grouped.set(eco, {
          ecoCode: eco,
          openingName: g.openingName,
          wins: 0,
          draws: 0,
          losses: 0,
          total: 0,
        });
      }
      const entry = grouped.get(eco)!;
      entry.total++;
      if (!entry.openingName && g.openingName) {
        entry.openingName = g.openingName;
      }

      const isWhite = g.whitePlayerId === id;
      if (g.result === "1-0") {
        isWhite ? entry.wins++ : entry.losses++;
      } else if (g.result === "0-1") {
        isWhite ? entry.losses++ : entry.wins++;
      } else if (g.result === "1/2-1/2") {
        entry.draws++;
      }
    }

    const openings = Array.from(grouped.values()).sort(
      (a, b) => b.total - a.total
    );

    return NextResponse.json({ openings });
  } catch (error) {
    console.error("Opening stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening stats" },
      { status: 500 }
    );
  }
}
