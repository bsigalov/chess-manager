import {
  DataProvider,
  ImportInput,
  NormalizedTournament,
  NormalizedPlayer,
  NormalizedPairing,
} from './types';

const LICHESS_API = 'https://lichess.org/api';

interface LichessTournamentInfo {
  id: string;
  fullName: string;
  nbPlayers: number;
  status: number; // 10=created, 20=started, 30=finished
  startsAt: number;
  finishesAt?: number;
  clock: { limit: number; increment: number };
  variant: { key: string; name: string };
  rated: boolean;
  nbRounds?: number;
  round?: number;
}

interface LichessArenaResult {
  username: string;
  rank: number;
  rating: number;
  score: number;
  title?: string;
  performance?: number;
  sheet?: { scores: (number | string)[] };
}

interface LichessSwissResult {
  username: string;
  rank: number;
  rating: number;
  points: number;
  title?: string;
  performance?: number;
  tieBreak?: number;
  federation?: string;
  fideId?: number;
}

interface LichessSwissInfo {
  id: string;
  name: string;
  nbPlayers: number;
  nbRounds: number;
  round: number;
  status: string; // "created" | "started" | "finished"
  startsAt: string;
  clock: { limit: number; increment: number };
  variant: string;
  rated: boolean;
}

interface LichessSwissRound {
  round: number;
  pairings: Array<{
    white: { user: string; rating: number; score?: number };
    black: { user: string; rating: number; score?: number };
    winner?: 'white' | 'black';
    result?: string;
  }>;
}

function formatTimeControl(clock: { limit: number; increment: number }): string {
  const minutes = Math.floor(clock.limit / 60);
  return `${minutes}+${clock.increment}`;
}

function mapLichessStatus(status: number | string): string {
  if (typeof status === 'string') {
    if (status === 'finished') return 'completed';
    if (status === 'started') return 'ongoing';
    return 'upcoming';
  }
  if (status >= 30) return 'completed';
  if (status >= 20) return 'ongoing';
  return 'upcoming';
}

function extractTournamentId(input: ImportInput): string {
  if (input.tournamentId) return input.tournamentId;
  if (input.url) {
    // Handle URLs like:
    //   https://lichess.org/tournament/xxxxx
    //   https://lichess.org/swiss/xxxxx
    //   https://lichess.org/api/tournament/xxxxx
    const tournamentMatch = input.url.match(/\/(?:tournament|swiss|api\/tournament|api\/swiss)\/([a-zA-Z0-9]+)/);
    if (tournamentMatch) return tournamentMatch[1];

    // Fallback: last path segment
    const parts = input.url.replace(/\/$/, '').split('/');
    return parts[parts.length - 1];
  }
  throw new Error('LichessProvider requires a URL or tournamentId');
}

function isSwissUrl(input: ImportInput): boolean {
  if (input.url && input.url.includes('/swiss/')) return true;
  return false;
}

/**
 * Parse an NDJSON (newline-delimited JSON) response body into an array of objects.
 */
async function parseNDJSON<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const results: T[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed lines
    }
  }
  return results;
}

async function fetchJSON<T>(url: string, accept = 'application/json'): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: accept },
  });
  if (!res.ok) {
    throw new Error(`Lichess API error: HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function fetchNDJSON<T>(url: string): Promise<T[]> {
  const res = await fetch(url, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!res.ok) {
    throw new Error(`Lichess API error: HTTP ${res.status} for ${url}`);
  }
  return parseNDJSON<T>(res);
}

export class LichessProvider implements DataProvider {
  readonly sourceType = 'lichess' as const;

  canHandle(input: ImportInput): boolean {
    if (input.sourceType === 'lichess') return true;
    if (input.url && input.url.includes('lichess.org')) return true;
    return false;
  }

  async fetchTournament(input: ImportInput): Promise<NormalizedTournament> {
    const id = extractTournamentId(input);

    if (isSwissUrl(input)) {
      return this.fetchSwissTournament(id, input);
    }

    return this.fetchArenaTournament(id, input);
  }

  async fetchDelta(
    input: ImportInput,
    _since: Date
  ): Promise<Partial<NormalizedTournament>> {
    // Re-fetch the full tournament for simplicity — Lichess API is fast
    const tournament = await this.fetchTournament(input);
    return {
      currentRound: tournament.currentRound,
      status: tournament.status,
      players: tournament.players,
      pairings: tournament.pairings,
    };
  }

  private async fetchArenaTournament(
    id: string,
    input: ImportInput
  ): Promise<NormalizedTournament> {
    const info = await fetchJSON<LichessTournamentInfo>(
      `${LICHESS_API}/tournament/${id}`
    );

    const results = await fetchNDJSON<LichessArenaResult>(
      `${LICHESS_API}/tournament/${id}/results`
    );

    const players: NormalizedPlayer[] = results.map((r) => ({
      name: r.username,
      fideId: null,
      title: r.title ?? null,
      rating: r.rating,
      country: null,
      startingRank: r.rank,
    }));

    const startsAt = new Date(info.startsAt);
    const endsAt = info.finishesAt ? new Date(info.finishesAt) : startsAt;

    return {
      externalId: info.id,
      sourceType: 'lichess',
      sourceUrl: input.url || `https://lichess.org/tournament/${id}`,
      name: info.fullName,
      venue: 'lichess.org',
      city: null,
      country: null,
      startDate: startsAt,
      endDate: endsAt,
      rounds: info.nbRounds ?? 0,
      currentRound: info.round ?? 0,
      timeControl: formatTimeControl(info.clock),
      tournamentType: 'arena',
      status: mapLichessStatus(info.status),
      players,
      pairings: [], // Arena tournaments don't have fixed pairings
    };
  }

  private async fetchSwissTournament(
    id: string,
    input: ImportInput
  ): Promise<NormalizedTournament> {
    const info = await fetchJSON<LichessSwissInfo>(
      `${LICHESS_API}/swiss/${id}`
    );

    const results = await fetchNDJSON<LichessSwissResult>(
      `${LICHESS_API}/swiss/${id}/results`
    );

    const players: NormalizedPlayer[] = results.map((r) => ({
      name: r.username,
      fideId: r.fideId ? String(r.fideId) : null,
      title: r.title ?? null,
      rating: r.rating,
      country: r.federation ?? null,
      startingRank: r.rank,
    }));

    // Fetch round pairings for Swiss tournaments
    const pairings: NormalizedPairing[] = [];
    for (let round = 1; round <= info.round; round++) {
      try {
        const roundData = await fetchJSON<LichessSwissRound>(
          `${LICHESS_API}/swiss/${id}/round/${round}`
        );
        if (roundData.pairings) {
          for (let i = 0; i < roundData.pairings.length; i++) {
            const p = roundData.pairings[i];
            let result: string | null = null;
            if (p.winner === 'white') result = '1-0';
            else if (p.winner === 'black') result = '0-1';
            else if (p.result === 'draw') result = '1/2-1/2';

            pairings.push({
              round,
              board: i + 1,
              whiteName: p.white.user,
              blackName: p.black.user,
              whiteRating: p.white.rating,
              blackRating: p.black.rating,
              result,
            });
          }
        }
      } catch {
        // Round data may not be available — skip
      }
    }

    const startsAt = new Date(info.startsAt);

    return {
      externalId: info.id,
      sourceType: 'lichess',
      sourceUrl: input.url || `https://lichess.org/swiss/${id}`,
      name: info.name,
      venue: 'lichess.org',
      city: null,
      country: null,
      startDate: startsAt,
      endDate: startsAt, // Swiss tournaments don't always expose end date
      rounds: info.nbRounds,
      currentRound: info.round,
      timeControl: formatTimeControl(info.clock),
      tournamentType: 'swiss',
      status: mapLichessStatus(info.status),
      players,
      pairings,
    };
  }
}
