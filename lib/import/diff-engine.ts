/**
 * Differential update engine for tournament data.
 *
 * Compares the current database state of a tournament against new normalized
 * data and returns only the actual changes. This avoids unnecessary writes
 * and enables efficient event-driven notifications.
 */

import { prisma } from '@/lib/db';
import {
  NormalizedTournament,
  NormalizedPlayer,
  NormalizedPairing,
} from '@/lib/providers/types';

export interface TournamentDiff {
  newPlayers: NormalizedPlayer[];
  newPairings: NormalizedPairing[];
  updatedResults: Array<{ round: number; board: number; result: string }>;
  newRound: boolean;
}

/**
 * Compare the existing DB state of a tournament with new normalized data.
 * Returns only what has actually changed.
 */
export async function computeDiff(
  tournamentId: string,
  newData: NormalizedTournament
): Promise<TournamentDiff> {
  const diff: TournamentDiff = {
    newPlayers: [],
    newPairings: [],
    updatedResults: [],
    newRound: false,
  };

  // Fetch existing tournament with related data
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: {
        include: { player: true },
      },
      pairings: true,
    },
  });

  if (!tournament) {
    // Tournament doesn't exist yet -- everything is new
    diff.newPlayers = newData.players;
    diff.newPairings = newData.pairings;
    diff.newRound = newData.currentRound > 0;
    return diff;
  }

  // Check for new round
  if (newData.currentRound > tournament.currentRound) {
    diff.newRound = true;
  }

  // Find new players (not in current tournament player list)
  const existingPlayerNames = new Set(
    tournament.players.map((tp) => tp.player.name)
  );

  for (const player of newData.players) {
    if (!existingPlayerNames.has(player.name)) {
      diff.newPlayers.push(player);
    }
  }

  // Build a lookup for existing pairings: "round:board" -> pairing
  const existingPairingMap = new Map<string, { result: string | null }>();
  for (const p of tournament.pairings) {
    existingPairingMap.set(`${p.round}:${p.board}`, {
      result: p.result,
    });
  }

  // Find new and updated pairings
  for (const pairing of newData.pairings) {
    const key = `${pairing.round}:${pairing.board}`;
    const existing = existingPairingMap.get(key);

    if (!existing) {
      diff.newPairings.push(pairing);
    } else if (
      pairing.result != null &&
      pairing.result !== existing.result
    ) {
      diff.updatedResults.push({
        round: pairing.round,
        board: pairing.board,
        result: pairing.result,
      });
    }
  }

  return diff;
}
