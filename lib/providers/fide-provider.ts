import {
  DataProvider,
  ImportInput,
  NormalizedPlayer,
  NormalizedTournament,
} from './types';

const FIDE_API = 'https://app.fide.com/api/v1';

interface FIDEPlayerResponse {
  id: number;
  name: string;
  title?: string;
  federation?: string;
  sex?: string;
  birth_year?: number;
  standard?: number;
  rapid?: number;
  blitz?: number;
  active?: boolean;
}

interface FIDESearchResponse {
  players?: FIDEPlayerResponse[];
  results?: FIDEPlayerResponse[];
}

export interface FIDEEnrichedData {
  fideId: string;
  name: string;
  title: string | null;
  rating: number | null;
  rapidRating: number | null;
  blitzRating: number | null;
  country: string | null;
  birthYear: number | null;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ChessManager/1.0',
    },
  });
  if (!res.ok) {
    throw new Error(`FIDE API error: HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

function mapFIDEPlayer(data: FIDEPlayerResponse): FIDEEnrichedData {
  return {
    fideId: String(data.id),
    name: data.name,
    title: data.title ?? null,
    rating: data.standard ?? null,
    rapidRating: data.rapid ?? null,
    blitzRating: data.blitz ?? null,
    country: data.federation ?? null,
    birthYear: data.birth_year ?? null,
  };
}

export class FIDEProvider implements DataProvider {
  readonly sourceType = 'fide' as const;

  canHandle(input: ImportInput): boolean {
    return input.sourceType === 'fide';
  }

  async fetchTournament(_input: ImportInput): Promise<NormalizedTournament> {
    throw new Error(
      'FIDE provider is not a tournament source. Use enrichPlayer() or enrichPlayers() for FIDE data lookup.'
    );
  }

  /**
   * Look up a player by FIDE ID and return enriched data.
   */
  async enrichPlayer(fideId: string): Promise<FIDEEnrichedData | null> {
    try {
      const data = await fetchJSON<FIDEPlayerResponse>(
        `${FIDE_API}/player/${fideId}`
      );
      return mapFIDEPlayer(data);
    } catch {
      return null;
    }
  }

  /**
   * Search for a player by name. Returns the best match or null.
   */
  async searchPlayer(name: string): Promise<FIDEEnrichedData | null> {
    try {
      const encoded = encodeURIComponent(name);
      const data = await fetchJSON<FIDESearchResponse>(
        `${FIDE_API}/search?query=${encoded}`
      );
      const players = data.players ?? data.results ?? [];
      if (players.length === 0) return null;
      return mapFIDEPlayer(players[0]);
    } catch {
      return null;
    }
  }

  /**
   * Enrich a list of normalized players with FIDE data.
   * Players with fideId get a direct lookup; others are skipped.
   * Returns a new array with enriched data merged in.
   */
  async enrichPlayers(players: NormalizedPlayer[]): Promise<NormalizedPlayer[]> {
    const results: NormalizedPlayer[] = [];

    for (const player of players) {
      if (!player.fideId) {
        results.push(player);
        continue;
      }

      const enriched = await this.enrichPlayer(player.fideId);
      if (!enriched) {
        results.push(player);
        continue;
      }

      results.push({
        ...player,
        rating: enriched.rating ?? player.rating,
        rapidRating: enriched.rapidRating ?? player.rapidRating ?? null,
        blitzRating: enriched.blitzRating ?? player.blitzRating ?? null,
        title: enriched.title ?? player.title,
        country: enriched.country ?? player.country,
      });
    }

    return results;
  }
}
