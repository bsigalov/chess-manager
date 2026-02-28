/**
 * Fetch all tournaments + games for an Israeli player from chess.org.il
 * and store them in the DB including opponent player records.
 *
 * Usage:
 *   npx --yes tsx@latest scripts/fetch-il-player-games.ts --player 205758
 *   npx --yes tsx@latest scripts/fetch-il-player-games.ts --player 205758 --dry-run
 */
import * as dotenv from 'dotenv';
dotenv.config();

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CookieSession,
  scrapePlayerGames,
  scrapePlayerTournaments,
  scrapePlayerProfile,
  type GameEntry,
  type TournamentEntry,
} from '../lib/scrapers/chess-org-il';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const playerIdx = args.indexOf('--player');
const israeliId = playerIdx !== -1 ? parseInt(args[playerIdx + 1], 10) : 205758;
const CUTOFF = new Date('2016-01-01');
const DELAY = 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stable short external ID for a chess.org.il tournament */
function makeExternalId(israeliId: number, tournamentName: string, date: Date): string {
  const slug = `${israeliId}-${tournamentName}-${date.getFullYear()}`;
  return 'il-' + crypto.createHash('md5').update(slug).digest('hex').slice(0, 10);
}

/** Map game result (from player's perspective) + color to PGN-style "1-0" / "0-1" / "1/2-1/2" */
function toPgnResult(result: 'win' | 'loss' | 'draw', color: 'white' | 'black'): string {
  if (result === 'draw') return '1/2-1/2';
  const playerWon = result === 'win';
  if (color === 'white') return playerWon ? '1-0' : '0-1';
  return playerWon ? '0-1' : '1-0';
}

/** Find or create a player by name (for opponents we don't have fideId) */
async function findOrCreateOpponent(name: string, rating?: number): Promise<string> {
  // Try exact name match in players table
  const existing = await prisma.player.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.player.create({
    data: {
      name,
      rating: rating ?? null,
      isActive: true,
      metadata: JSON.parse(JSON.stringify({ source: 'chess-org-il-opponent' })),
    },
  });
  return created.id;
}

/** Upsert a stub Tournament record from a TournamentEntry */
async function upsertTournament(
  israeliId: number,
  entry: TournamentEntry
): Promise<string> {
  const externalId = makeExternalId(israeliId, entry.tournamentName, entry.date);
  const endDate = new Date(entry.date);
  endDate.setDate(endDate.getDate() + Math.max(0, entry.games - 1)); // rough estimate

  const existing = await prisma.tournament.findUnique({ where: { externalId } });
  if (existing) return existing.id;

  const created = await prisma.tournament.create({
    data: {
      externalId,
      name: entry.tournamentName.slice(0, 255),
      startDate: entry.date,
      endDate,
      rounds: entry.games || 1,
      currentRound: entry.games || 1,
      status: 'completed',
      sourceUrl: `https://www.chess.org.il/Tournaments`,
      sourceType: 'chess-org-il',
      country: 'ISR',
      metadata: JSON.parse(JSON.stringify({
        israeliPlayerId: israeliId,
        points: entry.points,
        result: entry.result,
        performanceRating: entry.performanceRating,
        ratingChange: entry.ratingChange,
      })),
    },
  });
  return created.id;
}

/** Upsert TournamentPlayer link */
async function upsertTournamentPlayer(
  tournamentId: string,
  playerId: string,
  points: number,
  gamesPlayed: number,
  startingRating?: number,
  performance?: number
): Promise<void> {
  await prisma.tournamentPlayer.upsert({
    where: { tournamentId_playerId: { tournamentId, playerId } },
    update: { points, gamesPlayed, startingRating: startingRating ?? null, performance: performance ?? null },
    create: { tournamentId, playerId, points, gamesPlayed, startingRating: startingRating ?? null, performance: performance ?? null },
  });
}

/** Store a single game (Pairing + Game), skip if already exists */
async function storeGame(
  tournamentId: string,
  mainPlayerId: string,
  game: GameEntry,
  opponentId: string,
  board: number
): Promise<boolean> {
  const whiteId = game.color === 'white' ? mainPlayerId : opponentId;
  const blackId = game.color === 'white' ? opponentId : mainPlayerId;
  const result = toPgnResult(game.result, game.color);
  const round = game.round ?? 1;

  // Check existing pairing
  const existingPairing = await prisma.pairing.findUnique({
    where: { tournamentId_round_board: { tournamentId, round, board } },
  });
  if (existingPairing) return false; // already stored

  const pairing = await prisma.pairing.create({
    data: {
      tournamentId,
      round,
      board,
      whitePlayerId: whiteId,
      blackPlayerId: blackId,
      result,
      whiteElo: game.color === 'white' ? undefined : game.opponentRating ?? null,
      blackElo: game.color === 'black' ? undefined : game.opponentRating ?? null,
      playedAt: game.date,
    },
  });

  // Check existing game
  const existingGame = await prisma.game.findUnique({
    where: { tournamentId_round_board: { tournamentId, round, board } },
  });
  if (!existingGame) {
    await prisma.game.create({
      data: {
        pairingId: pairing.id,
        tournamentId,
        whitePlayerId: whiteId,
        blackPlayerId: blackId,
        round,
        board,
        result,
      },
    });
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Fetching games for Israeli player ${israeliId} ===`);
  if (isDryRun) console.log('[DRY RUN]');

  const session = new CookieSession();

  // 1. Get or find main player in DB
  const rows = await prisma.$queryRaw<{id:string, name:string}[]>`
    SELECT id, name FROM players WHERE metadata->>'israeliId' = ${String(israeliId)} LIMIT 1
  `;
  if (!rows.length) {
    console.error('Player not found in DB. Run fetch-il-player-games.ts --player first, or ensure player is imported.');
    process.exit(1);
  }
  const { id: mainPlayerId, name: mainPlayerName } = rows[0];
  console.log(`Main player: ${mainPlayerName} (${mainPlayerId})\n`);

  // 2. Scrape tournament list
  console.log('Scraping tournament history...');
  const tournaments = await scrapePlayerTournaments(session, israeliId, CUTOFF, DELAY);
  console.log(`  Found ${tournaments.length} tournaments since ${CUTOFF.toISOString().slice(0,10)}`);

  // 3. Scrape individual games
  console.log('Scraping games tab...');
  const games = await scrapePlayerGames(session, israeliId, CUTOFF, DELAY);
  console.log(`  Found ${games.length} individual games\n`);

  if (isDryRun) {
    console.log('Sample tournaments:');
    tournaments.slice(0, 3).forEach(t => console.log(`  ${t.date.toISOString().slice(0,10)} "${t.tournamentName}" ${t.games}g ${t.points}pts`));
    console.log('\nSample games:');
    games.slice(0, 5).forEach(g => console.log(`  ${g.date.toISOString().slice(0,10)} vs ${g.opponentName} (${g.opponentRating}) ${g.color} ${g.result} rd${g.round}`));
    await prisma.$disconnect();
    return;
  }

  // 4. Build tournament name → TournamentEntry map (use date for matching)
  const tournamentMap = new Map<string, { entry: TournamentEntry; dbId?: string }>();
  for (const t of tournaments) {
    const key = `${t.tournamentName}|${t.date.getFullYear()}`;
    tournamentMap.set(key, { entry: t });
  }

  // 5. Upsert tournaments
  console.log('Upserting tournaments...');
  let tCount = 0;
  for (const [key, val] of tournamentMap) {
    const dbId = await upsertTournament(israeliId, val.entry);
    val.dbId = dbId;
    await upsertTournamentPlayer(
      dbId, mainPlayerId,
      val.entry.points, val.entry.games,
      undefined, val.entry.performanceRating
    );
    tCount++;
    process.stdout.write(`\r  ${tCount}/${tournamentMap.size} tournaments`);
  }
  console.log(`\n  Done: ${tCount} tournaments upserted`);

  // 6. Process games — group by tournament key, assign board numbers per round
  console.log('\nStoring games...');
  let gSaved = 0, gSkipped = 0, gFailed = 0;

  // Track board numbers per (tournamentId, round)
  const boardCounters = new Map<string, number>();

  for (const game of games) {
    try {
      // Match game to tournament by name + year
      const year = game.date.getFullYear();
      // Try exact name match first, then partial
      let dbEntry = tournamentMap.get(`${game.tournamentName}|${year}`);
      if (!dbEntry) {
        // fallback: find by year
        for (const [k, v] of tournamentMap) {
          if (k.endsWith(`|${year}`) && v.entry.tournamentName.includes(game.tournamentName.slice(0, 10))) {
            dbEntry = v;
            break;
          }
        }
      }

      if (!dbEntry?.dbId) {
        // Create stub tournament from game data
        const stubEntry: TournamentEntry = {
          date: game.date,
          tournamentName: game.tournamentName,
          games: 1,
          points: 0,
          result: '',
        };
        const stubId = await upsertTournament(israeliId, stubEntry);
        await upsertTournamentPlayer(stubId, mainPlayerId, 0, 1);
        const newKey = `${game.tournamentName}|${year}`;
        tournamentMap.set(newKey, { entry: stubEntry, dbId: stubId });
        dbEntry = tournamentMap.get(newKey)!;
        tCount++;
      }

      const tournamentId = dbEntry.dbId!;
      const round = game.round ?? 1;

      // Assign board number (increment per round per tournament)
      const boardKey = `${tournamentId}|${round}`;
      const board = (boardCounters.get(boardKey) ?? 0) + 1;
      boardCounters.set(boardKey, board);

      // Find or create opponent
      const opponentId = await findOrCreateOpponent(game.opponentName, game.opponentRating);

      // Upsert opponent TournamentPlayer
      await upsertTournamentPlayer(tournamentId, opponentId, 0, 1, game.opponentRating);

      const stored = await storeGame(tournamentId, mainPlayerId, game, opponentId, board);
      if (stored) gSaved++;
      else gSkipped++;
    } catch (err) {
      gFailed++;
      console.error(`\n  Error storing game vs ${game.opponentName}: ${err}`);
    }
  }

  console.log(`  Saved: ${gSaved} | Skipped (already existed): ${gSkipped} | Failed: ${gFailed}`);

  // 7. Summary
  const finalTournamentCount = await prisma.tournamentPlayer.count({ where: { playerId: mainPlayerId } });
  const finalGameCount = await prisma.game.count({
    where: { OR: [{ whitePlayerId: mainPlayerId }, { blackPlayerId: mainPlayerId }] }
  });
  const uniqueOpponents = await prisma.$queryRaw<{count: string}[]>`
    SELECT COUNT(DISTINCT CASE WHEN white_player_id = ${mainPlayerId} THEN black_player_id ELSE white_player_id END) as count
    FROM games WHERE white_player_id = ${mainPlayerId} OR black_player_id = ${mainPlayerId}
  `;

  console.log('\n=== Result ===');
  console.log(`Tournaments in DB for player: ${finalTournamentCount}`);
  console.log(`Games in DB for player:        ${finalGameCount}`);
  console.log(`Unique opponents:              ${uniqueOpponents[0]?.count ?? 0}`);
  console.log(`\nView player: http://localhost:3002/players/${mainPlayerId}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
