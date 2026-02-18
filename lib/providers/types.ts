export type SourceType =
  | 'chess-results'
  | 'lichess'
  | 'chesscom'
  | 'pgn-file'
  | 'csv-file'
  | 'fide';

export interface ImportInput {
  sourceType: SourceType;
  url?: string;
  tournamentId?: string;
  fileContent?: string;
  fileName?: string;
}

export interface NormalizedPlayer {
  name: string;
  fideId: string | null;
  title: string | null;
  rating: number | null;
  rapidRating?: number | null;
  blitzRating?: number | null;
  country: string | null;
  startingRank?: number;
  points?: number;
  currentRank?: number;
  performance?: number | null;
  gamesPlayed?: number;
}

export interface NormalizedPairing {
  round: number;
  board: number;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  result: string | null;
}

export interface NormalizedTournament {
  externalId: string;
  sourceType: SourceType;
  sourceUrl: string;
  name: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  startDate: Date;
  endDate: Date;
  rounds: number;
  currentRound: number;
  timeControl: string | null;
  tournamentType: string | null;
  status: string;
  players: NormalizedPlayer[];
  pairings: NormalizedPairing[];
}

export interface DataProvider {
  sourceType: SourceType;
  canHandle(input: ImportInput): boolean;
  fetchTournament(input: ImportInput): Promise<NormalizedTournament>;
  fetchDelta?(input: ImportInput, since: Date): Promise<Partial<NormalizedTournament>>;
}
