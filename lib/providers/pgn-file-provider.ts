import {
  DataProvider,
  ImportInput,
  NormalizedTournament,
  NormalizedPlayer,
  NormalizedPairing,
} from './types';
import { parsePGN } from '@/lib/parsers/pgn-parser';
import { ParsedPGN } from '@/lib/types/chess-moves';

function parseDate(dateStr: string | undefined): Date {
  if (!dateStr || dateStr === '????.??.??' || dateStr === '?') return new Date();
  // PGN dates use YYYY.MM.DD format
  const normalized = dateStr.replace(/\./g, '-').replace(/\?/g, '01');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date() : d;
}

function extractRound(roundStr: string | undefined): number {
  if (!roundStr || roundStr === '?' || roundStr === '-') return 0;
  // Handle "3.1" (round 3, board 1) — take the round part
  const num = parseInt(roundStr.split('.')[0], 10);
  return isNaN(num) ? 0 : num;
}

function normalizeResult(result: string): string | null {
  if (result === '1-0') return '1-0';
  if (result === '0-1') return '0-1';
  if (result === '1/2-1/2') return '1/2-1/2';
  return null;
}

function generateExternalId(fileName: string | undefined, eventName: string): string {
  const base = fileName?.replace(/\.pgn$/i, '') || eventName;
  return `pgn-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)}`;
}

/**
 * Build a player map from PGN games, collecting all unique players
 * and their highest known rating.
 */
function buildPlayerMap(games: ParsedPGN[]): Map<string, NormalizedPlayer> {
  const players = new Map<string, NormalizedPlayer>();

  for (const game of games) {
    const { headers } = game;

    const addOrUpdate = (name: string, eloStr: string | undefined, titleKey?: string) => {
      if (!name || name === '?') return;
      const rating = eloStr ? parseInt(eloStr, 10) : null;
      const validRating = rating && !isNaN(rating) && rating > 0 ? rating : null;

      const existing = players.get(name);
      if (existing) {
        // Keep the highest known rating
        if (validRating && (!existing.rating || validRating > existing.rating)) {
          existing.rating = validRating;
        }
      } else {
        // Extract title from player name if present (e.g., "GM Carlsen, Magnus")
        let title: string | null = null;
        let cleanName = name;
        const titleMatch = name.match(/^(GM|IM|FM|CM|WGM|WIM|WFM|WCM|NM)\s+/);
        if (titleMatch) {
          title = titleMatch[1];
          cleanName = name.slice(titleMatch[0].length);
        }

        // Check for title in headers (WhiteTitle, BlackTitle)
        if (!title && titleKey && headers[titleKey]) {
          title = headers[titleKey] ?? null;
        }

        players.set(name, {
          name: cleanName,
          fideId: null,
          title,
          rating: validRating,
          country: null,
        });
      }
    };

    addOrUpdate(headers.White, headers.WhiteElo, 'WhiteTitle');
    addOrUpdate(headers.Black, headers.BlackElo, 'BlackTitle');

    // Extract FIDE IDs if present
    if (headers.WhiteFideId) {
      const p = players.get(headers.White);
      if (p) p.fideId = headers.WhiteFideId;
    }
    if (headers.BlackFideId) {
      const p = players.get(headers.Black);
      if (p) p.fideId = headers.BlackFideId;
    }

    // Extract country/team if present
    if (headers.WhiteTeam) {
      const p = players.get(headers.White);
      if (p && !p.country) p.country = headers.WhiteTeam;
    }
    if (headers.BlackTeam) {
      const p = players.get(headers.Black);
      if (p && !p.country) p.country = headers.BlackTeam;
    }
  }

  return players;
}

function buildPairings(games: ParsedPGN[]): NormalizedPairing[] {
  const pairings: NormalizedPairing[] = [];
  // Track board numbers per round
  const boardCounters = new Map<number, number>();

  for (const game of games) {
    const { headers } = game;
    const round = extractRound(headers.Round);
    const white = headers.White;
    const black = headers.Black;

    if (!white || white === '?' || !black || black === '?') continue;

    const currentBoard = (boardCounters.get(round) ?? 0) + 1;
    boardCounters.set(round, currentBoard);

    const whiteElo = headers.WhiteElo ? parseInt(headers.WhiteElo, 10) : null;
    const blackElo = headers.BlackElo ? parseInt(headers.BlackElo, 10) : null;

    pairings.push({
      round: round || 1,
      board: currentBoard,
      whiteName: white,
      blackName: black,
      whiteRating: whiteElo && !isNaN(whiteElo) ? whiteElo : null,
      blackRating: blackElo && !isNaN(blackElo) ? blackElo : null,
      result: normalizeResult(headers.Result),
    });
  }

  return pairings;
}

export class PGNFileProvider implements DataProvider {
  readonly sourceType = 'pgn-file' as const;

  canHandle(input: ImportInput): boolean {
    if (input.sourceType === 'pgn-file') return true;
    if (input.fileName && input.fileName.toLowerCase().endsWith('.pgn')) return true;
    return false;
  }

  async fetchTournament(input: ImportInput): Promise<NormalizedTournament> {
    const content = input.fileContent;
    if (!content || content.trim().length === 0) {
      throw new Error('PGNFileProvider requires non-empty fileContent');
    }

    const games = parsePGN(content);
    if (games.length === 0) {
      throw new Error('No valid PGN games found in the provided content');
    }

    // Use the first game's headers as the tournament-level info
    const firstHeaders = games[0].headers;
    const eventName = firstHeaders.Event !== '?' ? firstHeaders.Event : (input.fileName ?? 'Imported PGN');
    const site = firstHeaders.Site !== '?' ? firstHeaders.Site : null;

    // Compute total rounds from the games
    let maxRound = 0;
    for (const game of games) {
      const r = extractRound(game.headers.Round);
      if (r > maxRound) maxRound = r;
    }

    const playerMap = buildPlayerMap(games);
    const players = Array.from(playerMap.values());

    // Assign starting ranks
    players.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    players.forEach((p, i) => (p.startingRank = i + 1));

    const pairings = buildPairings(games);

    // Parse date from first game
    const startDate = parseDate(firstHeaders.Date);

    // Try to find the last game date for endDate
    let endDate = startDate;
    for (const game of games) {
      const d = parseDate(game.headers.Date);
      if (d > endDate) endDate = d;
    }

    const externalId = generateExternalId(input.fileName, eventName);

    return {
      externalId,
      sourceType: 'pgn-file',
      sourceUrl: input.fileName ? `file://${input.fileName}` : 'file://imported.pgn',
      name: eventName,
      venue: site,
      city: null,
      country: null,
      startDate,
      endDate,
      rounds: maxRound || 1,
      currentRound: maxRound || 1,
      timeControl: firstHeaders.TimeControl ?? null,
      tournamentType: null,
      status: 'completed',
      players,
      pairings,
    };
  }
}
