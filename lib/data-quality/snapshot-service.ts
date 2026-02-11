import { prisma } from '@/lib/db';

interface StandingsEntry {
  playerId: string;
  playerName: string;
  rank: number;
  points: number;
  tiebreak1: number | null;
  tiebreak2: number | null;
  performance: number | null;
}

/**
 * Capture a standings snapshot for a specific tournament round.
 * Upserts to avoid duplicates when re-capturing the same round.
 */
export async function captureSnapshot(
  tournamentId: string,
  round: number
): Promise<void> {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
    orderBy: [{ points: 'desc' }, { currentRank: 'asc' }],
  });

  const standings: StandingsEntry[] = tournamentPlayers.map((tp, index) => ({
    playerId: tp.playerId,
    playerName: tp.player.name,
    rank: tp.currentRank ?? index + 1,
    points: tp.points,
    tiebreak1: (tp.metadata as Record<string, unknown>)?.tiebreak1 as number | null ?? null,
    tiebreak2: (tp.metadata as Record<string, unknown>)?.tiebreak2 as number | null ?? null,
    performance: tp.performance,
  }));

  await prisma.tournamentSnapshot.upsert({
    where: {
      tournamentId_round: { tournamentId, round },
    },
    create: {
      tournamentId,
      round,
      standings: standings as unknown as Parameters<typeof prisma.tournamentSnapshot.create>[0]['data']['standings'],
      scrapedAt: new Date(),
    },
    update: {
      standings: standings as unknown as Parameters<typeof prisma.tournamentSnapshot.create>[0]['data']['standings'],
      scrapedAt: new Date(),
    },
  });
}

/**
 * Retrieve all snapshots for a tournament, ordered by round.
 */
export async function getSnapshots(
  tournamentId: string
): Promise<Array<{ round: number; standings: StandingsEntry[] }>> {
  const snapshots = await prisma.tournamentSnapshot.findMany({
    where: { tournamentId },
    orderBy: { round: 'asc' },
    select: { round: true, standings: true },
  });

  return snapshots.map((s) => ({
    round: s.round,
    standings: s.standings as unknown as StandingsEntry[],
  }));
}
