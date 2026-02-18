import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        tournaments: {
          include: {
            tournament: {
              select: {
                id: true,
                name: true,
                city: true,
                country: true,
                startDate: true,
                endDate: true,
                rounds: true,
                status: true,
              },
            },
          },
          orderBy: {
            tournament: { startDate: "desc" },
          },
        },
        ratingHistory: {
          orderBy: { recordedAt: "desc" },
        },
        aliases: true,
        claims: {
          where: { status: "approved" },
          select: { userId: true },
          take: 1,
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const isClaimed = player.claims.length > 0;

    return NextResponse.json({
      id: player.id,
      fideId: player.fideId,
      name: player.name,
      title: player.title,
      rating: player.rating,
      rapidRating: player.rapidRating,
      blitzRating: player.blitzRating,
      country: player.country,
      birthYear: player.birthYear,
      isActive: player.isActive,
      isClaimed,
      tournaments: player.tournaments.map((tp) => ({
        tournamentId: tp.tournament.id,
        tournamentName: tp.tournament.name,
        city: tp.tournament.city,
        country: tp.tournament.country,
        startDate: tp.tournament.startDate,
        endDate: tp.tournament.endDate,
        rounds: tp.tournament.rounds,
        status: tp.tournament.status,
        startingRank: tp.startingRank,
        currentRank: tp.currentRank,
        startingRating: tp.startingRating,
        points: tp.points,
        performance: tp.performance,
      })),
      ratingHistory: player.ratingHistory.map((rh) => ({
        id: rh.id,
        ratingType: rh.ratingType,
        rating: rh.rating,
        source: rh.source,
        recordedAt: rh.recordedAt,
      })),
      aliases: player.aliases.map((a) => ({
        id: a.id,
        alias: a.alias,
        source: a.source,
      })),
    });
  } catch (error) {
    console.error("Player detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch player" },
      { status: 500 }
    );
  }
}
