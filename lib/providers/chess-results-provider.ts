import {
  DataProvider,
  ImportInput,
  NormalizedTournament,
  NormalizedPlayer,
  NormalizedPairing,
} from './types';
import {
  parseTournamentUrl,
  scrapeTournamentInfo,
  scrapePlayerList,
  scrapePairings,
  TournamentInfo,
  PlayerEntry,
  PairingEntry,
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

function buildSourceUrl(tournamentId: string): string {
  return `https://chess-results.com/tnr${tournamentId}.aspx?lan=1`;
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

    const info = await scrapeTournamentInfo(tournamentId);
    const playerEntries = await scrapePlayerList(tournamentId);

    // Fetch pairings for all available rounds
    const allPairings: NormalizedPairing[] = [];
    for (let round = 1; round <= info.currentRound; round++) {
      try {
        const roundPairings = await scrapePairings(tournamentId, round);
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

    return this.mapToNormalized(tournamentId, info, playerEntries, allPairings);
  }

  async fetchDelta(
    input: ImportInput,
    since: Date
  ): Promise<Partial<NormalizedTournament>> {
    // Chess-results doesn't expose change timestamps, so we re-fetch
    // the current round's pairings as the most likely source of updates.
    const tournamentId = this.resolveTournamentId(input);
    const info = await scrapeTournamentInfo(tournamentId);

    const pairings: NormalizedPairing[] = [];
    if (info.currentRound > 0) {
      try {
        const roundPairings = await scrapePairings(tournamentId, info.currentRound);
        for (const p of roundPairings) {
          pairings.push(mapPairing(p, info.currentRound));
        }
      } catch {
        // If current round pairings aren't available, return empty delta
      }
    }

    return {
      currentRound: info.currentRound,
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
    players: PlayerEntry[],
    pairings: NormalizedPairing[]
  ): NormalizedTournament {
    return {
      externalId: tournamentId,
      sourceType: 'chess-results',
      sourceUrl: buildSourceUrl(tournamentId),
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
      players: players.map(mapPlayer),
      pairings,
    };
  }
}
