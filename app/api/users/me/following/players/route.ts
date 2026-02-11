import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await requireAuth();

    const followedPlayers = await prisma.followedPlayer.findMany({
      where: { userId: user.id },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            title: true,
            rating: true,
            country: true,
            fideId: true,
            tournaments: {
              include: {
                tournament: {
                  select: {
                    id: true,
                    name: true,
                    startDate: true,
                    status: true,
                  },
                },
              },
              orderBy: { tournament: { startDate: "desc" } },
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const players = followedPlayers.map((fp) => ({
      followId: fp.id,
      alias: fp.alias,
      notifications: fp.notifications,
      followedAt: fp.createdAt,
      player: {
        id: fp.player.id,
        name: fp.player.name,
        title: fp.player.title,
        rating: fp.player.rating,
        country: fp.player.country,
        fideId: fp.player.fideId,
        recentTournaments: fp.player.tournaments.map((tp) => ({
          tournamentId: tp.tournament.id,
          tournamentName: tp.tournament.name,
          startDate: tp.tournament.startDate,
          status: tp.tournament.status,
          points: tp.points,
          currentRank: tp.currentRank,
          performance: tp.performance,
        })),
      },
    }));

    return NextResponse.json({ players });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Get followed players error:", error);
    return NextResponse.json(
      { error: "Failed to fetch followed players" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 }
      );
    }

    // Verify player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Check if already following
    const existing = await prisma.followedPlayer.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already following this player" },
        { status: 409 }
      );
    }

    const follow = await prisma.followedPlayer.create({
      data: {
        userId: user.id,
        playerId,
      },
    });

    return NextResponse.json(
      {
        id: follow.id,
        playerId: follow.playerId,
        createdAt: follow.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Follow player error:", error);
    return NextResponse.json(
      { error: "Failed to follow player" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.followedPlayer.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not following this player" },
        { status: 404 }
      );
    }

    await prisma.followedPlayer.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Unfollow player error:", error);
    return NextResponse.json(
      { error: "Failed to unfollow player" },
      { status: 500 }
    );
  }
}
