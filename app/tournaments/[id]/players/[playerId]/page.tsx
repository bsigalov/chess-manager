import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { parseBaseUrl, scrapeCrosstable } from "@/lib/scrapers/chess-results";
import type { CrosstableEntry } from "@/lib/types/tournament";
import { computePlayerStats } from "@/lib/analytics/player-stats";
import { computeRatingProgression } from "@/lib/analytics/elo";
import { computeStandingsAfterRound } from "@/lib/analytics/standings";
import { PlayerTournamentView } from "@/components/features/player-tournament-view";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

async function getCrosstable(
  tournament: {
    id: string;
    sourceUrl: string;
    externalId: string;
    metadata: unknown;
  }
): Promise<CrosstableEntry[] | null> {
  const metadata = (tournament.metadata as Record<string, unknown>) || {};

  if (metadata.crosstable) {
    return metadata.crosstable as CrosstableEntry[];
  }

  // Scrape and cache
  try {
    const baseUrl = parseBaseUrl(tournament.sourceUrl);
    const crosstable = await scrapeCrosstable(tournament.externalId, baseUrl);

    if (crosstable.length > 0) {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          metadata: JSON.parse(
            JSON.stringify({ ...metadata, crosstable })
          ),
        },
      });
    }

    return crosstable.length > 0 ? crosstable : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}): Promise<Metadata> {
  const { id, playerId } = await params;
  const startingRank = parseInt(playerId, 10);

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true, metadata: true },
  });

  if (!tournament) return { title: "Not Found" };

  const metadata = (tournament.metadata as Record<string, unknown>) || {};
  const crosstable = metadata.crosstable as CrosstableEntry[] | undefined;
  const player = crosstable?.find((e) => e.startingRank === startingRank);
  const playerName = player?.name ?? `Player #${startingRank}`;
  const titlePrefix = player?.title ? `${player.title} ` : "";

  return {
    title: `${titlePrefix}${playerName} - ${tournament.name}`,
    description: `Tournament journey for ${titlePrefix}${playerName} in ${tournament.name}`,
  };
}

export default async function PlayerTournamentPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = await params;
  const startingRank = parseInt(playerId, 10);

  if (isNaN(startingRank)) notFound();

  // Load tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      externalId: true,
      sourceUrl: true,
      metadata: true,
      rounds: true,
    },
  });

  if (!tournament) notFound();

  // Get crosstable (cached or fresh)
  const crosstable = await getCrosstable(tournament);

  if (!crosstable) {
    return (
      <div className="container px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">{tournament.name}</h1>
        <p className="text-muted-foreground">
          Crosstable data is not available for this tournament.
        </p>
      </div>
    );
  }

  // Find the player in crosstable
  const playerEntry = crosstable.find((e) => e.startingRank === startingRank);
  if (!playerEntry) notFound();

  // Compute player stats
  const stats = computePlayerStats(startingRank, crosstable);

  // Build games array for rating progression
  const games = playerEntry.roundResults.map((rr) => {
    let opponentRating: number | null = null;
    let opponentName = "BYE";

    if (rr.opponentRank !== null) {
      const opponent = crosstable.find(
        (e) => e.startingRank === rr.opponentRank
      );
      if (opponent) {
        opponentRating = opponent.rating;
        opponentName = opponent.name;
      }
    }

    return {
      round: rr.round,
      opponentRating,
      opponentName,
      result: rr.score,
      color: rr.color as "w" | "b" | null,
      isBye: rr.isBye,
      isForfeit: rr.isForfeit,
    };
  });

  // Compute rating progression (only if player has a rating)
  const ratingProgression =
    playerEntry.rating !== null
      ? computeRatingProgression(
          playerEntry.rating,
          games.map((g) => ({
            opponentRating: g.opponentRating,
            result: g.result,
            round: g.round,
          }))
        )
      : [];

  // Compute rank progression across rounds
  const totalRounds = Math.max(
    ...crosstable.flatMap((e) => e.roundResults.map((r) => r.round))
  );

  const rankProgression: { round: number; rank: number; points: number }[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const roundStandings = computeStandingsAfterRound(crosstable, round);
    const playerStanding = roundStandings.find(
      (s) => s.startingRank === startingRank
    );
    if (playerStanding) {
      rankProgression.push({
        round,
        rank: playerStanding.rank,
        points: playerStanding.points,
      });
    }
  }

  // Look up TournamentPlayer to get the DB player ID for profile link
  const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
    where: {
      tournamentId: id,
      startingRank,
    },
    select: { playerId: true },
  });

  // Build cumulative scores for the games array
  const gamesWithCumulative = games.reduce<Array<{
    round: number;
    color: "w" | "b" | null;
    opponentName: string;
    opponentRating: number | null;
    result: number;
    cumulativeScore: number;
    isBye: boolean;
    isForfeit: boolean;
  }>>((acc, g) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulativeScore : 0;
    acc.push({
      round: g.round,
      color: g.color,
      opponentName: g.opponentName,
      opponentRating: g.opponentRating,
      result: g.result,
      cumulativeScore: prev + g.result,
      isBye: g.isBye,
      isForfeit: g.isForfeit,
    });
    return acc;
  }, []);

  // Build rating progression props (include opponentRating and actual result)
  const ratingProgressionProps = ratingProgression.map((step) => ({
    round: step.round,
    ratingAfter: Math.round(step.ratingAfter),
    ratingChange: Math.round(step.ratingChange * 10) / 10,
    expectedScore: Math.round(step.expectedScore * 1000) / 1000,
    opponentRating: step.opponentRating,
    actualResult: step.result,
  }));

  return (
    <>
      <div className="container px-4 pt-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tournaments", href: "/tournaments" },
            { label: tournament.name, href: `/tournaments/${tournament.id}` },
            { label: playerEntry.name },
          ]}
        />
      </div>
      <PlayerTournamentView
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      playerName={playerEntry.name}
      playerTitle={playerEntry.title}
      playerRating={playerEntry.rating}
      playerDbId={tournamentPlayer?.playerId ?? null}
      stats={{
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        whiteGames: stats.whiteGames,
        blackGames: stats.blackGames,
        whiteScore: stats.whiteScore,
        blackScore: stats.blackScore,
        averageOpponentRating: stats.averageOpponentRating,
        performanceRating: stats.performanceRating,
        scoreProgression: stats.scoreProgression,
      }}
      games={gamesWithCumulative}
      ratingProgression={ratingProgressionProps}
      rankProgression={rankProgression}
      crosstable={crosstable}
      totalRounds={tournament.rounds || totalRounds}
    />
    </>
  );
}
