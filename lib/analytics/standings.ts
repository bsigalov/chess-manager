import type {
  CrosstableEntry,
  StandingsWithTiebreaks,
} from "@/lib/types/tournament";
import { buchholz, sonnebornBerger } from "@/lib/analytics/tiebreaks";

/**
 * Compute performance rating for a player.
 * Formula: avg opponent rating + 400 * (W - L) / N
 * Only considers rounds where the opponent has a rating.
 * Returns null if no rated opponents.
 */
function computePerformanceRating(
  entry: CrosstableEntry,
  crosstable: CrosstableEntry[]
): number | null {
  const ratedGames: { opponentRating: number; score: number }[] = [];

  for (const rr of entry.roundResults) {
    if (rr.opponentRank === null) continue;
    const opponent = crosstable.find(
      (e) => e.startingRank === rr.opponentRank
    );
    if (!opponent || opponent.rating === null) continue;
    ratedGames.push({ opponentRating: opponent.rating, score: rr.score });
  }

  if (ratedGames.length === 0) return null;

  const N = ratedGames.length;
  const avgOpponentRating =
    ratedGames.reduce((sum, g) => sum + g.opponentRating, 0) / N;
  const totalScore = ratedGames.reduce((sum, g) => sum + g.score, 0);

  // (W - L) / N = (2 * score - N) / N, capped at [-1, 1]
  const diff = Math.max(-1, Math.min(1, (2 * totalScore - N) / N));

  return Math.round(avgOpponentRating + 400 * diff);
}

/**
 * Truncate a crosstable to only include rounds 1..round.
 * Recalculates each player's points from the truncated results.
 */
function truncateCrosstable(
  crosstable: CrosstableEntry[],
  round: number
): CrosstableEntry[] {
  return crosstable.map((entry) => {
    const truncatedResults = entry.roundResults.filter(
      (rr) => rr.round <= round
    );
    const points = truncatedResults.reduce((sum, rr) => sum + rr.score, 0);
    return {
      ...entry,
      roundResults: truncatedResults,
      points,
    };
  });
}

/**
 * Compute full standings with tiebreaks from a crosstable.
 * Sorts by: points (desc), buchholz (desc), sonnebornBerger (desc).
 * Assigns rank 1..N.
 */
export function computeStandings(
  crosstable: CrosstableEntry[]
): StandingsWithTiebreaks[] {
  const entries = crosstable.map((entry) => {
    const bh = buchholz(entry.startingRank, crosstable);
    const sb = sonnebornBerger(entry.startingRank, crosstable);
    const perf = computePerformanceRating(entry, crosstable);

    return {
      startingRank: entry.startingRank,
      name: entry.name,
      rating: entry.rating,
      points: entry.points,
      rank: 0, // assigned after sorting
      buchholz: bh,
      sonnebornBerger: sb,
      performanceRating: perf,
    };
  });

  // Sort: points desc, buchholz desc, sonnebornBerger desc
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.sonnebornBerger - a.sonnebornBerger;
  });

  // Assign ranks 1..N
  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
  }

  return entries;
}

/**
 * Compute standings after a specific round.
 * Creates a truncated crosstable using only rounds 1..round,
 * then computes standings from it. Useful for rank progression charts.
 */
export function computeStandingsAfterRound(
  crosstable: CrosstableEntry[],
  round: number
): StandingsWithTiebreaks[] {
  const truncated = truncateCrosstable(crosstable, round);
  return computeStandings(truncated);
}
