import {
  DataProvider,
  ImportInput,
  NormalizedTournament,
  NormalizedPlayer,
  NormalizedPairing,
} from './types';
import {
  parseTournamentUrl,
  parseBaseUrl,
  parsePersistentParams,
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
  scrapeStandings,
  TournamentInfo,
  PlayerEntry,
  PairingEntry,
  StandingsEntry,
} from '@/lib/scrapers/chess-results';

function parseDate(dateStr: string | null): Date {
  if (!dateStr) return new Date();
  // chess-results uses YYYY/MM/DD format
  const normalized = dateStr.replace(/\//g, '-');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date() : d;
}

function mapPlayer(entry: PlayerEntry): NormalizedPlayer {
  return {
    name: entry.name,
    fideId: entry.fideId,
    title: entry.title,
    rating: entry.rating,
    country: entry.federation,
    startingRank: entry.startingRank,
  };
}

function mapPairing(entry: PairingEntry, round: number): NormalizedPairing {
  return {
    round,
    board: entry.board,
    whiteName: entry.whiteName,
    blackName: entry.blackName,
    whiteRating: entry.whiteRating,
    blackRating: entry.blackRating,
    result: entry.result,
  };
}

function buildSourceUrl(tournamentId: string, baseUrl?: string): string {
  const base = baseUrl || 'https://chess-results.com';
  return `${base}/tnr${tournamentId}.aspx?lan=1`;
}

export class ChessResultsProvider implements DataProvider {
  readonly sourceType = 'chess-results' as const;

  canHandle(input: ImportInput): boolean {
    if (input.sourceType === 'chess-results') return true;
    if (input.url && input.url.includes('chess-results.com')) return true;
    return false;
  }

  async fetchTournament(input: ImportInput): Promise<NormalizedTournament> {
    const tournamentId = this.resolveTournamentId(input);
    const baseUrl = input.url ? parseBaseUrl(input.url) : undefined;
    const extra = input.url ? parsePersistentParams(input.url) : undefined;

    const info = await scrapeTournamentInfo(tournamentId, baseUrl, extra);
    const playerEntries = await scrapePlayerList(tournamentId, baseUrl, extra);

    // Fetch standings FIRST — the info page often lacks round count,
    // but standings heading has "Final Ranking after N Rounds"
    let standingsEntries: StandingsEntry[] = [];
    try {
      standingsEntries = await scrapeStandings(tournamentId, undefined, baseUrl, extra);
    } catch {
      // Standings may not be available — continue without them
    }

    // Use standings round count when info page returned 0
    let totalRounds = info.rounds;
    let currentRound = info.currentRound;
    if (totalRounds === 0 && standingsEntries.length > 0 && standingsEntries[0].gamesPlayed) {
      totalRounds = standingsEntries[0].gamesPlayed;
      currentRound = totalRounds; // standings exist → tournament is complete
    }

    // Fetch pairings for all available rounds
    const allPairings: NormalizedPairing[] = [];
    for (let round = 1; round <= currentRound; round++) {
      try {
        const roundPairings = await scrapePairings(tournamentId, round, baseUrl, extra);
        for (const p of roundPairings) {
          allPairings.push(mapPairing(p, round));
        }
      } catch {
        // Some rounds may not have pairings yet — skip silently
      }
    }

    // Enrich pairings with player ratings from the player list
    const ratingByName = new Map<string, number | null>();
    for (const entry of playerEntries) {
      ratingByName.set(entry.name, entry.rating);
    }
    for (const pairing of allPairings) {
      if (pairing.whiteRating === null) {
        pairing.whiteRating = ratingByName.get(pairing.whiteName) ?? null;
      }
      if (pairing.blackRating === null) {
        pairing.blackRating = ratingByName.get(pairing.blackName) ?? null;
      }
    }

    // Merge standings into players
    const normalizedPlayers = playerEntries.map(mapPlayer);
    mergeStandings(normalizedPlayers, standingsEntries);

    // Override info's round counts with the corrected values
    const correctedInfo = { ...info, rounds: totalRounds, currentRound };

    return this.mapToNormalized(tournamentId, correctedInfo, normalizedPlayers, allPairings, baseUrl);
  }

  async fetchDelta(
    input: ImportInput,
    since: Date
  ): Promise<Partial<NormalizedTournament>> {
    // Chess-results doesn't expose change timestamps, so we re-fetch
    // the current round's pairings as the most likely source of updates.
    const tournamentId = this.resolveTournamentId(input);
    const baseUrl = input.url ? parseBaseUrl(input.url) : undefined;
    const extra = input.url ? parsePersistentParams(input.url) : undefined;
    const info = await scrapeTournamentInfo(tournamentId, baseUrl, extra);

    // Resolve round count — info page often returns 0
    let currentRound = info.currentRound;
    if (currentRound === 0) {
      try {
        const standings = await scrapeStandings(tournamentId, undefined, baseUrl, extra);
        if (standings.length > 0 && standings[0].gamesPlayed) {
          currentRound = standings[0].gamesPlayed;
        }
      } catch {
        // If standings unavailable, stay with 0
      }
    }

    const pairings: NormalizedPairing[] = [];
    if (currentRound > 0) {
      try {
        const roundPairings = await scrapePairings(tournamentId, currentRound, baseUrl, extra);
        for (const p of roundPairings) {
          pairings.push(mapPairing(p, currentRound));
        }
      } catch {
        // If current round pairings aren't available, return empty delta
      }
    }

    return {
      currentRound,
      status: info.status,
      pairings,
    };
  }

  private resolveTournamentId(input: ImportInput): string {
    if (input.tournamentId) return input.tournamentId;
    if (input.url) return parseTournamentUrl(input.url);
    throw new Error('ChessResultsProvider requires a URL or tournamentId');
  }

  private mapToNormalized(
    tournamentId: string,
    info: TournamentInfo,
    players: NormalizedPlayer[],
    pairings: NormalizedPairing[],
    baseUrl?: string
  ): NormalizedTournament {
    return {
      externalId: tournamentId,
      sourceType: 'chess-results',
      sourceUrl: buildSourceUrl(tournamentId, baseUrl),
      name: info.name,
      venue: info.venue,
      city: info.city,
      country: info.country,
      startDate: parseDate(info.startDate),
      endDate: parseDate(info.endDate),
      rounds: info.rounds,
      currentRound: info.currentRound,
      timeControl: info.timeControl,
      tournamentType: info.tournamentType,
      status: info.status,
      players,
      pairings,
    };
  }
}

/**
 * Merge standings data into normalized players by matching on name.
 */
function mergeStandings(
  players: NormalizedPlayer[],
  standings: StandingsEntry[]
): void {
  const standingsByName = new Map<string, StandingsEntry>();
  for (const s of standings) {
    standingsByName.set(s.name, s);
  }

  for (const player of players) {
    const s = standingsByName.get(player.name);
    if (!s) continue;
    player.currentRank = s.rank;
    player.points = s.points;
    player.performance = s.performance;
    player.gamesPlayed = s.gamesPlayed ?? undefined;
  }
}
