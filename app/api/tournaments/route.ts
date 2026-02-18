import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q");
    const status = searchParams.get("status");
    const country = searchParams.get("country");

    const where: Prisma.TournamentWhereInput = {};

    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }
    if (status) {
      where.status = status;
    }
    if (country) {
      where.country = country;
    }

    const tournaments = await prisma.tournament.findMany({
      where,
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
