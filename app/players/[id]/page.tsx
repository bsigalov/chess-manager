import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { PlayerProfile } from "@/components/features/player-profile";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

async function getPlayer(id: string) {
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

  if (!player) return null;

  return {
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
    isClaimed: player.claims.length > 0,
    metadata: player.metadata as Record<string, unknown> | null,
    tournaments: player.tournaments.map((tp) => ({
      tournamentId: tp.tournament.id,
      tournamentName: tp.tournament.name,
      city: tp.tournament.city,
      country: tp.tournament.country,
      startDate: tp.tournament.startDate.toISOString(),
      endDate: tp.tournament.endDate.toISOString(),
      rounds: tp.tournament.rounds,
      status: tp.tournament.status,
      startingRank: tp.startingRank,
      currentRank: tp.currentRank,
      startingRating: tp.startingRating,
      currentRating: tp.currentRating,
      points: tp.points,
      performance: tp.performance,
    })),
    ratingHistory: player.ratingHistory.map((rh) => ({
      id: rh.id,
      ratingType: rh.ratingType,
      rating: rh.rating,
      source: rh.source,
      recordedAt: rh.recordedAt.toISOString(),
    })),
    aliases: player.aliases.map((a) => ({
      id: a.id,
      alias: a.alias,
      source: a.source,
    })),
  };
}

async function getFollowingStatus(playerId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const follow = await prisma.followedPlayer.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId,
        },
      },
    });

    return !!follow;
  } catch {
    return false;
  }
}

async function getClaimStatus(playerId: string): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const claim = await prisma.playerClaim.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId,
        },
      },
    });

    return claim?.status ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };

  const titlePrefix = player.title ? `${player.title} ` : "";
  return {
    title: `${titlePrefix}${player.name} - Chess Tournament Manager`,
    description: `Player profile for ${titlePrefix}${player.name}${player.country ? ` (${player.country})` : ""}. Rating: ${player.rating ?? "Unrated"}.`,
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [player, isFollowing, claimStatus] = await Promise.all([
    getPlayer(id),
    getFollowingStatus(id),
    getClaimStatus(id),
  ]);

  if (!player) notFound();

  return (
    <>
      <div className="container px-4 pt-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Players", href: "/players" },
            { label: player.name },
          ]}
        />
      </div>
      <Suspense>
        <PlayerProfile
          player={player}
          isFollowing={isFollowing}
          claimStatus={claimStatus}
        />
      </Suspense>
    </>
  );
}
