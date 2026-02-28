import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import {
  CookieSession,
  scrapeSearchPlayers,
  scrapePlayerGames,
  scrapePlayerTournaments,
  type TournamentEntry,
} from '../lib/scrapers/chess-org-il';
import {
  prisma, delay,
  upsertTournament, upsertTournamentPlayer,
  findOrCreateOpponent, storeGame,
  reconstructRatings, upsertIsraeliRatingHistory,
} from './lib/chess-org-il-import';

const CUTOFF = new Date('2016-01-01');
const DELAY = 1000;
const WORKERS = 5;

async function processPlayer(israeliId: number, name: string, israeliRating: number, workerId: number): Promise<void> {
  const session = new CookieSession();
  await delay(workerId * 500);

  const rows = await prisma.$queryRaw<{id:string}[]>`
    SELECT id FROM players WHERE metadata->>'israeliId' = ${String(israeliId)} LIMIT 1
  `;
  let mainPlayerId: string;
  if (!rows.length) {
    const created = await prisma.player.create({
      data: { name, isActive: true, metadata: JSON.parse(JSON.stringify({ israeliId, source: 'chess-org-il' })) },
    });
    mainPlayerId = created.id;
  } else {
    mainPlayerId = rows[0].id;
  }

  try {
    const [tournaments, games] = await Promise.all([
      scrapePlayerTournaments(session, israeliId, CUTOFF, DELAY),
      scrapePlayerGames(session, israeliId, CUTOFF, DELAY),
    ]);

    const withRatings = reconstructRatings(tournaments, israeliRating);

    // Build tournament map keyed by name|year
    const tournamentMap = new Map<string, { entry: TournamentEntry & { startingRating: number; endRating: number }; dbId?: string }>();
    for (const t of withRatings) {
      tournamentMap.set(`${t.tournamentName}|${t.date.getFullYear()}`, { entry: t });
    }
    for (const [, val] of tournamentMap) {
      const dbId = await upsertTournament(israeliId, val.entry);
      val.dbId = dbId;
      await upsertTournamentPlayer(dbId, mainPlayerId, val.entry.points, val.entry.games, val.entry.startingRating, val.entry.endRating, val.entry.performanceRating);
    }

    await upsertIsraeliRatingHistory(mainPlayerId, withRatings);

    // Store games — look up the tournament to get the player's startingRating for that event
    const boardCounters = new Map<string, number>();
    let saved = 0;
    for (const game of games) {
      const year = game.date.getFullYear();
      let dbEntry = tournamentMap.get(`${game.tournamentName}|${year}`);
      if (!dbEntry) {
        for (const [k, v] of tournamentMap) {
          if (k.endsWith(`|${year}`) && v.entry.tournamentName.includes(game.tournamentName.slice(0, 10))) { dbEntry = v; break; }
        }
      }
      if (!dbEntry?.dbId) {
        const stubEntry: TournamentEntry = { date: game.date, tournamentName: game.tournamentName, games: 1, points: 0, result: '' };
        const stubId = await upsertTournament(israeliId, stubEntry);
        await upsertTournamentPlayer(stubId, mainPlayerId, 0, 1);
        const key = `${game.tournamentName}|${year}`;
        tournamentMap.set(key, { entry: { ...stubEntry, startingRating: 0, endRating: 0 }, dbId: stubId });
        dbEntry = tournamentMap.get(key)!;
      }
      const tournamentId = dbEntry.dbId!;
      const boardKey = `${tournamentId}|${game.round ?? 1}`;
      const board = (boardCounters.get(boardKey) ?? 0) + 1;
      boardCounters.set(boardKey, board);

      const opponentId = await findOrCreateOpponent(game.opponentName, game.opponentIsraeliId, game.opponentRating);
      await upsertTournamentPlayer(tournamentId, opponentId, 0, 1, game.opponentRating);

      const stored = await storeGame(tournamentId, mainPlayerId, game, opponentId, board, dbEntry.entry.startingRating || undefined);
      if (stored) saved++;
    }

    console.log(`[W${workerId}] ✓ ${name} (${israeliId}, ${israeliRating}): ${tournaments.length} tournaments, ${saved}/${games.length} new pairings, ${withRatings.length} rating history entries`);
  } catch (err) {
    console.error(`[W${workerId}] ✗ ${name} (${israeliId}): ${err}`);
  }
}

async function main() {
  console.log('=== Fetching elite Israeli players (ELO > 2000, last 10 years) ===\n');

  const session = new CookieSession();
  console.log('Fetching player list from chess.org.il...');
  const allPlayers = await scrapeSearchPlayers(session, { activeCardOnly: true }, 500);

  const target = allPlayers
    .filter(p => p.israeliRating > 2000)
    .sort((a, b) => b.israeliRating - a.israeliRating);

  console.log(`Found ${target.length} players with Israeli rating > 2000\n`);
  for (const p of target) {
    console.log(`  ${p.name} (${p.israeliRating})`);
  }
  console.log();

  const queue = [...target];
  let queueIdx = 0;
  async function worker(workerId: number) {
    while (true) {
      const idx = queueIdx++;
      if (idx >= queue.length) break;
      const p = queue[idx];
      await processPlayer(p.israeliId, p.name, p.israeliRating, workerId);
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
