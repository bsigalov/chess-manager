/**
 * Database upsert logic for tournament data.
 *
 * Takes a NormalizedTournament and persists it to the database, handling:
 *   - Tournament create/update by externalId
 *   - Player matching via player-matcher (FIDE ID -> name+country -> create)
 *   - TournamentPlayer link upserts
 *   - Pairing upserts (matched by tournament+round+board)
 */

import { prisma } from '@/lib/db';
import { NormalizedTournament } from '@/lib/providers/types';
import { findOrCreatePlayer } from './player-matcher';

export interface UpsertStats {
  playersCreated: number;
  playersUpdated: number;
  pairingsCreated: number;
  pairingsUpdated: number;
}

export interface UpsertResult {
  tournamentId: string;
  created: boolean;
  stats: UpsertStats;
}

/**
 * Upsert a full tournament with players and pairings.
 */
export async function upsertTournament(
  data: NormalizedTournament
): Promise<UpsertResult> {
  const stats: UpsertStats = {
    playersCreated: 0,
    playersUpdated: 0,
    pairingsCreated: 0,
    pairingsUpdated: 0,
  };

  // 1. Upsert the tournament record
  const existing = await prisma.tournament.findUnique({
    where: { externalId: data.externalId },
  });

  const tournamentData = {
    name: data.name,
    venue: data.venue,
    city: data.city,
    country: data.country,
    startDate: data.startDate,
    endDate: data.endDate,
    rounds: data.rounds,
    currentRound: data.currentRound,
    timeControl: data.timeControl,
    tournamentType: data.tournamentType,
    status: data.status,
    sourceUrl: data.sourceUrl,
    sourceType: data.sourceType,
    lastScrapedAt: new Date(),
  };

  const tournament = existing
    ? await prisma.tournament.update({
        where: { externalId: data.externalId },
        data: tournamentData,
      })
    : await prisma.tournament.create({
        data: {
          externalId: data.externalId,
          ...tournamentData,
        },
      });

  const created = !existing;
  const tournamentId = tournament.id;

  // 2. Process players -- build a name->playerId map for pairing resolution
  const playerNameToId = new Map<string, string>();

  for (const normalizedPlayer of data.players) {
    const match = await findOrCreatePlayer(normalizedPlayer);

    if (match.created) {
      stats.playersCreated++;
    } else {
      stats.playersUpdated++;
    }

    playerNameToId.set(normalizedPlayer.name, match.id);

    // Upsert the TournamentPlayer link
    await prisma.tournamentPlayer.upsert({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: match.id,
        },
      },
      create: {
        tournamentId,
        playerId: match.id,
        startingRank: normalizedPlayer.startingRank ?? null,
        startingRating: normalizedPlayer.rating,
        currentRank: normalizedPlayer.currentRank ?? null,
        points: normalizedPlayer.points ?? 0,
        performance: normalizedPlayer.performance ?? null,
        gamesPlayed: normalizedPlayer.gamesPlayed ?? 0,
      },
      update: {
        startingRank: normalizedPlayer.startingRank ?? undefined,
        startingRating: normalizedPlayer.rating ?? undefined,
        currentRank: normalizedPlayer.currentRank ?? undefined,
        points: normalizedPlayer.points ?? undefined,
        performance: normalizedPlayer.performance ?? undefined,
        gamesPlayed: normalizedPlayer.gamesPlayed ?? undefined,
      },
    });
  }

  // 3. Upsert pairings
  for (const pairing of data.pairings) {
    const whitePlayerId = playerNameToId.get(pairing.whiteName) ?? null;
    const blackPlayerId = playerNameToId.get(pairing.blackName) ?? null;

    const existingPairing = await prisma.pairing.findUnique({
      where: {
        tournamentId_round_board: {
          tournamentId,
          round: pairing.round,
          board: pairing.board,
        },
      },
    });

    if (existingPairing) {
      await prisma.pairing.update({
        where: { id: existingPairing.id },
        data: {
          whitePlayerId,
          blackPlayerId,
          result: pairing.result,
          whiteElo: pairing.whiteRating,
          blackElo: pairing.blackRating,
        },
      });
      stats.pairingsUpdated++;
    } else {
      await prisma.pairing.create({
        data: {
          tournamentId,
          round: pairing.round,
          board: pairing.board,
          whitePlayerId,
          blackPlayerId,
          result: pairing.result,
          whiteElo: pairing.whiteRating,
          blackElo: pairing.blackRating,
        },
      });
      stats.pairingsCreated++;
    }
  }

  return { tournamentId, created, stats };
}
