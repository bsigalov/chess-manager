import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth-helpers";

const VALID_VERIFICATION_TYPES = [
  "fide_email",
  "tournament_proof",
  "admin_manual",
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    const body = await request.json();
    const { verificationType, verificationData } = body;

    if (
      !verificationType ||
      !VALID_VERIFICATION_TYPES.includes(verificationType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid verification type. Must be one of: ${VALID_VERIFICATION_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check player exists
    const player = await prisma.player.findUnique({
      where: { id },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Check if player is already claimed by another user
    const existingApprovedClaim = await prisma.playerClaim.findFirst({
      where: {
        playerId: id,
        status: "approved",
        userId: { not: user.id },
      },
    });

    if (existingApprovedClaim) {
      return NextResponse.json(
        { error: "This player has already been claimed by another user" },
        { status: 409 }
      );
    }

    // Check if user already has a pending or approved claim on this player
    const existingUserClaim = await prisma.playerClaim.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId: id,
        },
      },
    });

    if (existingUserClaim) {
      return NextResponse.json(
        {
          error: `You already have a ${existingUserClaim.status} claim on this player`,
          claim: {
            id: existingUserClaim.id,
            status: existingUserClaim.status,
            createdAt: existingUserClaim.createdAt,
          },
        },
        { status: 409 }
      );
    }

    const claim = await prisma.playerClaim.create({
      data: {
        userId: user.id,
        playerId: id,
        verificationType,
        verificationData: verificationData ?? null,
      },
    });

    return NextResponse.json(
      {
        id: claim.id,
        status: claim.status,
        verificationType: claim.verificationType,
        createdAt: claim.createdAt,
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
    console.error("Player claim error:", error);
    return NextResponse.json(
      { error: "Failed to create claim" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ claim: null });
    }

    const claim = await prisma.playerClaim.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId,
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ claim: null });
    }

    return NextResponse.json({
      claim: {
        id: claim.id,
        status: claim.status,
        verificationType: claim.verificationType,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get claim status error:", error);
    return NextResponse.json(
      { error: "Failed to get claim status" },
      { status: 500 }
    );
  }
}
