import type {
  CrosstableEntry,
  SimulationPlayerResult,
  SimulationResult,
} from "@/lib/types/tournament";
import { winDrawLossProbability } from "@/lib/analytics/elo";

const DEFAULT_RATING = 1500;
const DEFAULT_ITERATIONS = 50_000;

interface PlayerState {
  startingRank: number;
  name: string;
  rating: number;
  basePoints: number;
  points: number;
}

/**
 * Run a Monte Carlo simulation to predict tournament outcomes.
 *
 * Uses Swiss-style pairing approximation: each remaining round, players are
 * sorted by current points (desc) then starting rank (asc) as tiebreak,
 * then paired top-half vs bottom-half (player[0] vs player[1], etc.).
 *
 * For each pairing, winDrawLossProbability() determines outcome probabilities
 * using player ratings. A random number selects the result.
 */
export function runSimulation(
  crosstable: CrosstableEntry[],
  totalRounds: number,
  iterations: number = DEFAULT_ITERATIONS
): SimulationResult {
  const n = crosstable.length;

  // Determine completed rounds: max round number with actual results
  const completedRounds = crosstable.reduce((max, entry) => {
    for (const rr of entry.roundResults) {
      if (rr.round > max) max = rr.round;
    }
    return max;
  }, 0);

  // Build base player states
  const basePlayers: PlayerState[] = crosstable.map((entry) => ({
    startingRank: entry.startingRank,
    name: entry.name,
    rating: entry.rating ?? DEFAULT_RATING,
    basePoints: entry.points,
    points: entry.points,
  }));

  // If tournament is already complete, return deterministic results
  if (completedRounds >= totalRounds) {
    return buildDeterministicResult(basePlayers, totalRounds, completedRounds);
  }

  // Accumulators
  const positionCounts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );
  const pointsSums = new Float64Array(n);
  const pointsSqSums = new Float64Array(n);

  // Map startingRank -> index for fast lookup
  const rankToIndex = new Map<number, number>();
  basePlayers.forEach((p, i) => rankToIndex.set(p.startingRank, i));

  for (let iter = 0; iter < iterations; iter++) {
    // Reset points to base
    const players: PlayerState[] = basePlayers.map((p) => ({
      ...p,
      points: p.basePoints,
    }));

    // Simulate remaining rounds
    for (let round = completedRounds + 1; round <= totalRounds; round++) {
      // Sort by points desc, then starting rank asc as tiebreak
      players.sort(
        (a, b) => b.points - a.points || a.startingRank - b.startingRank
      );

      // Pair top-half vs bottom-half
      for (let i = 0; i + 1 < players.length; i += 2) {
        const white = players[i];
        const black = players[i + 1];

        const { win, draw } = winDrawLossProbability(
          white.rating,
          black.rating
        );

        const roll = Math.random();
        if (roll < win) {
          white.points += 1;
        } else if (roll < win + draw) {
          white.points += 0.5;
          black.points += 0.5;
        } else {
          black.points += 1;
        }
      }
    }

    // Determine final positions (sort by points desc, starting rank asc)
    players.sort(
      (a, b) => b.points - a.points || a.startingRank - b.startingRank
    );

    for (let pos = 0; pos < players.length; pos++) {
      const idx = rankToIndex.get(players[pos].startingRank)!;
      positionCounts[idx][pos]++;
      pointsSums[idx] += players[pos].points;
      pointsSqSums[idx] += players[pos].points * players[pos].points;
    }
  }

  // Aggregate results
  const playerResults: SimulationPlayerResult[] = basePlayers.map((p, i) => {
    const expectedPoints = pointsSums[i] / iterations;
    const variance = pointsSqSums[i] / iterations - expectedPoints ** 2;
    const stdDev = Math.sqrt(Math.max(0, variance));

    const probFirst = positionCounts[i][0] / iterations;
    const probTop3 =
      (positionCounts[i][0] + positionCounts[i][1] + positionCounts[i][2]) /
      iterations;

    const positionDistribution = positionCounts[i].map(
      (count) => count / iterations
    );

    return {
      startingRank: p.startingRank,
      name: p.name,
      probFirst,
      probTop3,
      expectedPoints,
      pointsStdDev: stdDev,
      positionDistribution,
    };
  });

  return {
    iterations,
    totalRounds,
    completedRounds,
    players: playerResults,
  };
}

/**
 * Build deterministic result when all rounds are complete (no simulation needed).
 */
function buildDeterministicResult(
  players: PlayerState[],
  totalRounds: number,
  completedRounds: number
): SimulationResult {
  const n = players.length;

  // Sort to determine actual final positions
  const sorted = [...players].sort(
    (a, b) => b.points - a.points || a.startingRank - b.startingRank
  );

  // Map startingRank -> final position (0-indexed)
  const rankToPosition = new Map<number, number>();
  sorted.forEach((p, pos) => rankToPosition.set(p.startingRank, pos));

  const playerResults: SimulationPlayerResult[] = players.map((p) => {
    const pos = rankToPosition.get(p.startingRank)!;
    const positionDistribution = new Array(n).fill(0);
    positionDistribution[pos] = 1;

    return {
      startingRank: p.startingRank,
      name: p.name,
      probFirst: pos === 0 ? 1 : 0,
      probTop3: pos < 3 ? 1 : 0,
      expectedPoints: p.points,
      pointsStdDev: 0,
      positionDistribution,
    };
  });

  return {
    iterations: 0,
    totalRounds,
    completedRounds,
    players: playerResults,
  };
}
