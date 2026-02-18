// ─── Crosstable Types ────────────────────────────────────

export interface PlayerRoundResult {
  round: number;
  opponentRank: number | null; // null for BYE
  color: "w" | "b" | null;
  score: number; // 1, 0.5, 0
  isForfeit: boolean;
  isBye: boolean;
}

export interface CrosstableEntry {
  startingRank: number;
  name: string;
  title: string | null;
  rating: number | null;
  federation: string | null;
  points: number;
  roundResults: PlayerRoundResult[];
}

// ─── Analytics Types ─────────────────────────────────────

export interface RatingStep {
  round: number;
  opponentRating: number | null;
  result: number;
  expectedScore: number;
  ratingChange: number;
  ratingAfter: number;
}

export interface PlayerStats {
  startingRank: number;
  name: string;
  rating: number | null;
  wins: number;
  draws: number;
  losses: number;
  whiteGames: number;
  blackGames: number;
  whiteScore: number;
  blackScore: number;
  averageOpponentRating: number | null;
  performanceRating: number | null;
  scoreProgression: number[]; // cumulative score after each round
}

export interface StandingsWithTiebreaks {
  startingRank: number;
  name: string;
  rating: number | null;
  points: number;
  rank: number;
  buchholz: number;
  sonnebornBerger: number;
  performanceRating: number | null;
}

// ─── Simulation Types ────────────────────────────────────

export interface SimulationPlayerResult {
  startingRank: number;
  name: string;
  probFirst: number;
  probTop3: number;
  expectedPoints: number;
  pointsStdDev: number;
  positionDistribution: number[];
}

export interface SimulationResult {
  iterations: number;
  totalRounds: number;
  completedRounds: number;
  players: SimulationPlayerResult[];
}

export interface HypotheticalResult {
  round: number;
  playerRank: number;
  opponentRank: number;
  score: number; // 1, 0.5, 0
}
