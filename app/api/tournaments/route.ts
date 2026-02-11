import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { players: true } },
      },
    });

    const result = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      city: t.city,
      country: t.country,
      startDate: t.startDate,
      endDate: t.endDate,
      rounds: t.rounds,
      currentRound: t.currentRound,
      status: t.status,
      playerCount: t._count.players,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("List tournaments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournaments" },
      { status: 500 }
    );
  }
}
