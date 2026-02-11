import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await requireAuth();

    const bookmarks = await prisma.userTournamentBookmark.findMany({
      where: { userId: user.id },
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
            currentRound: true,
            status: true,
            _count: { select: { players: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tournaments = bookmarks.map((b) => ({
      bookmarkId: b.id,
      notifications: b.notifications,
      bookmarkedAt: b.createdAt,
      tournament: {
        id: b.tournament.id,
        name: b.tournament.name,
        city: b.tournament.city,
        country: b.tournament.country,
        startDate: b.tournament.startDate,
        endDate: b.tournament.endDate,
        rounds: b.tournament.rounds,
        currentRound: b.tournament.currentRound,
        status: b.tournament.status,
        playerCount: b.tournament._count.players,
      },
    }));

    return NextResponse.json({ tournaments });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Get bookmarked tournaments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookmarked tournaments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { tournamentId, notifications } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required" },
        { status: 400 }
      );
    }

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Check if already bookmarked
    const existing = await prisma.userTournamentBookmark.findUnique({
      where: {
        userId_tournamentId: {
          userId: user.id,
          tournamentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Tournament already bookmarked" },
        { status: 409 }
      );
    }

    const bookmark = await prisma.userTournamentBookmark.create({
      data: {
        userId: user.id,
        tournamentId,
        notifications: notifications ?? true,
      },
    });

    return NextResponse.json(
      {
        id: bookmark.id,
        tournamentId: bookmark.tournamentId,
        notifications: bookmark.notifications,
        createdAt: bookmark.createdAt,
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
    console.error("Bookmark tournament error:", error);
    return NextResponse.json(
      { error: "Failed to bookmark tournament" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { tournamentId } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.userTournamentBookmark.findUnique({
      where: {
        userId_tournamentId: {
          userId: user.id,
          tournamentId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 }
      );
    }

    await prisma.userTournamentBookmark.delete({
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
    console.error("Remove bookmark error:", error);
    return NextResponse.json(
      { error: "Failed to remove bookmark" },
      { status: 500 }
    );
  }
}
