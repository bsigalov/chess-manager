/**
 * Shared helpers for chess-org-il import scripts.
 * Handles tournament/player/game upserts with full rating data.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { GameEntry, TournamentEntry } from '../../lib/scrapers/chess-org-il';

export { delay } from '../../lib/scrapers/chess-results-parser';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

// ─── Tournament ──────────────────────────────────────────────────────────────

export function makeExternalId(israeliId: number, tournamentName: string, date: Date): string {
  const slug = `${israeliId}-${tournamentName}-${date.getFullYear()}`;
  return 'il-' + crypto.createHash('md5').update(slug).digest('hex').slice(0, 10);
}

export async function upsertTournament(israeliId: number, entry: TournamentEntry): Promise<string> {
  const externalId = makeExternalId(israeliId, entry.tournamentName, entry.date);
  const endDate = new Date(entry.date);
  endDate.setDate(endDate.getDate() + Math.max(0, entry.games - 1));
  const existing = await prisma.tournament.findUnique({ where: { externalId } });
  if (existing) return existing.id;
  const created = await prisma.tournament.create({
    data: {
      externalId, name: entry.tournamentName.slice(0, 255),
      startDate: entry.date, endDate, rounds: entry.games || 1,
      currentRound: entry.games || 1, status: 'completed',
      sourceUrl: 'https://www.chess.org.il/Tournaments', sourceType: 'chess-org-il',
      country: 'ISR',
      metadata: JSON.parse(JSON.stringify({
        israeliPlayerId: israeliId,
        israeliTournamentId: entry.israeliTournamentId,
        points: entry.points,
        result: entry.result,
        performanceRating: entry.performanceRating,
        ratingChange: entry.ratingChange,
      })),
    },
  });
  return created.id;
}

// ─── TournamentPlayer ────────────────────────────────────────────────────────

export async function upsertTournamentPlayer(
  tournamentId: string,
  playerId: string,
  points: number,
  gamesPlayed: number,
  startingRating?: number,
  currentRating?: number,
  performance?: number,
): Promise<void> {
  await prisma.tournamentPlayer.upsert({
    where: { tournamentId_playerId: { tournamentId, playerId } },
    update: {
      points, gamesPlayed,
      startingRating: startingRating ?? null,
      currentRating: currentRating ?? null,
      performance: performance ?? null,
    },
    create: {
      tournamentId, playerId, points, gamesPlayed,
      startingRating: startingRating ?? null,
      currentRating: currentRating ?? null,
      performance: performance ?? null,
    },
  });
}

// ─── Opponent lookup ─────────────────────────────────────────────────────────

export async function findOrCreateOpponent(
  name: string,
  israeliId?: number,
  rating?: number,
): Promise<string> {
  // Prefer matching by israeliId in metadata (most reliable)
  if (israeliId) {
    const rows = await prisma.$queryRaw<{id:string}[]>`
      SELECT id FROM players WHERE metadata->>'israeliId' = ${String(israeliId)} LIMIT 1
    `;
    if (rows.length) return rows[0].id;
  }
  // Fall back to name match
  const existing = await prisma.player.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  // Create new opponent stub
  const created = await prisma.player.create({
    data: {
      name, rating: rating ?? null, isActive: true,
      metadata: JSON.parse(JSON.stringify({
        israeliId: israeliId ?? null,
        source: 'chess-org-il-opponent',
      })),
    },
  });
  return created.id;
}

// ─── Game storage ─────────────────────────────────────────────────────────────

function toPgnResult(result: 'win' | 'loss' | 'draw', color: 'white' | 'black'): string {
  if (result === 'draw') return '1/2-1/2';
  if (color === 'white') return result === 'win' ? '1-0' : '0-1';
  return result === 'win' ? '0-1' : '1-0';
}

/**
 * Store a game. If the pairing already exists, backfills any missing elo.
 * Returns true if a new pairing was inserted, false if it already existed.
 *
 * @param mainPlayerRating - main player's starting rating for this tournament
 */
export async function storeGame(
  tournamentId: string,
  mainPlayerId: string,
  game: GameEntry,
  opponentId: string,
  board: number,
  mainPlayerRating?: number,
): Promise<boolean> {
  const whiteId = game.color === 'white' ? mainPlayerId : opponentId;
  const blackId = game.color === 'white' ? opponentId : mainPlayerId;
  const result = toPgnResult(game.result, game.color);
  const round = game.round ?? 1;

  // Elo for each color — white/black elo = that player's rating, not the opponent's
  const mainElo = mainPlayerRating ?? null;
  const opponentElo = game.opponentRating ?? null;
  const whiteElo = game.color === 'white' ? mainElo : opponentElo;
  const blackElo = game.color === 'black' ? mainElo : opponentElo;

  const existingPairing = await prisma.pairing.findUnique({
    where: { tournamentId_round_board: { tournamentId, round, board } },
    select: { id: true, whiteElo: true, blackElo: true },
  });

  if (existingPairing) {
    // Backfill any elo that was null when first written
    const patch: { whiteElo?: number; blackElo?: number } = {};
    if (existingPairing.whiteElo == null && whiteElo != null) patch.whiteElo = whiteElo;
    if (existingPairing.blackElo == null && blackElo != null) patch.blackElo = blackElo;
    if (Object.keys(patch).length > 0) {
      await prisma.pairing.update({ where: { id: existingPairing.id }, data: patch });
    }
    return false;
  }

  const pairing = await prisma.pairing.create({
    data: {
      tournamentId, round, board,
      whitePlayerId: whiteId, blackPlayerId: blackId,
      result, whiteElo, blackElo,
      playedAt: game.date,
    },
  });

  const existingGame = await prisma.game.findUnique({
    where: { tournamentId_round_board: { tournamentId, round, board } },
  });
  if (!existingGame) {
    await prisma.game.create({
      data: {
        pairingId: pairing.id, tournamentId,
        whitePlayerId: whiteId, blackPlayerId: blackId,
        round, board, result,
      },
    });
  }
  return true;
}

// ─── ELO reconstruction ──────────────────────────────────────────────────────

export type TournamentWithRatings = TournamentEntry & {
  startingRating: number;
  endRating: number;
};

/**
 * Reconstruct per-tournament starting/ending ratings by working backwards
 * from the player's current rating using ratingChange per tournament.
 */
export function reconstructRatings(
  tournaments: TournamentEntry[],
  currentRating: number,
): TournamentWithRatings[] {
  const sorted = [...tournaments].sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = currentRating;
  const result: TournamentWithRatings[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const change = sorted[i].ratingChange ?? 0;
    const startRating = running - change;
    result.unshift({ ...sorted[i], startingRating: startRating, endRating: running });
    running = startRating;
  }
  return result;
}

// ─── RatingHistory upsert ────────────────────────────────────────────────────

export async function upsertIsraeliRatingHistory(
  playerId: string,
  withRatings: TournamentWithRatings[],
): Promise<void> {
  await prisma.ratingHistory.deleteMany({ where: { playerId, ratingType: 'israeli' } });
  if (withRatings.length === 0) return;
  await prisma.ratingHistory.createMany({
    data: withRatings.map(t => ({
      playerId,
      ratingType: 'israeli',
      rating: t.startingRating,
      source: 'chess-org-il',
      recordedAt: t.date,
    })),
  });
}
