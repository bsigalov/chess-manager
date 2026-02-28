/**
 * player-analytics.ts
 * Compute analytics metrics from player rating history and game data.
 */

import type {
  RatingEntry,
  TournamentEntry,
  GameEntry,
} from "@/lib/scrapers/chess-org-il";
import type { DeepPlayerData } from "@/lib/cache/player-cache";

// ─── Types ─────────────────────────────────────────────────────────────────

export type MomentumClassification = "rising" | "declining" | "plateau";

export interface WinRateBand {
  band: string;
  games: number;
  wins: number;
  rate: number;
}

export interface TournamentGain {
  name: string;
  date: Date;
  gain: number;
}

export interface PeakRating {
  rating: number;
  date: Date;
}

export interface Prediction {
  rating: number;
  low: number;   // 95% confidence lower bound
  high: number;  // 95% confidence upper bound
  slope: number; // monthly rate of change
  r2: number;    // regression fit quality
}

export interface PlayerAnalytics {
  // Rating trend
  velocity: number;                    // points per month (last 12mo)
  velocitySeries: number[];            // monthly velocity values for sparkline
  momentum: MomentumClassification;
  peakRating: number;
  peakDate: Date;
  monthsSincePeak: number;

  // Predictions (null if insufficient data)
  prediction3mo: Prediction | null;
  prediction6mo: Prediction | null;
  prediction12mo: Prediction | null;
  milestones: { target: number; estimatedMonths: number | null }[];

  // Efficiency (requires Tier 2+3 data)
  avgRatingGainPerTournament: number | null;
  tournamentGains: TournamentGain[] | null;
  winRateByBand: WinRateBand[] | null;
}

// ─── Velocity Calculation ─────────────────────────────────────────────────────

/**
 * Compute rating velocity (points gained/lost per month) over a window.
 * @param history Sorted rating history (oldest first)
 * @param windowMonths Lookback window in months (default: 12)
 * @returns Points per month
 */
export function computeVelocity(
  history: RatingEntry[],
  windowMonths = 12
): number {
  if (history.length < 2) return 0;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - windowMonths);

  // Filter to entries within the window
  const recentHistory = history.filter(
    (h) => new Date(h.recordedAt) >= cutoff
  );

  if (recentHistory.length < 2) {
    // Fall back to all available data if window too small
    const first = history[0];
    const last = history[history.length - 1];
    const months = monthsBetween(new Date(first.recordedAt), new Date(last.recordedAt));
    if (months === 0) return 0;
    return (last.rating - first.rating) / months;
  }

  const first = recentHistory[0];
  const last = recentHistory[recentHistory.length - 1];
  const months = monthsBetween(new Date(first.recordedAt), new Date(last.recordedAt));

  if (months === 0) return 0;
  return (last.rating - first.rating) / months;
}

/**
 * Compute monthly velocity series for sparkline visualization.
 * Returns velocity values for each month in the history.
 * @param history Sorted rating history (oldest first)
 * @returns Array of monthly velocity values
 */
export function computeVelocitySeries(history: RatingEntry[]): number[] {
  if (history.length < 2) return [];

  const velocities: number[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    const months = monthsBetween(new Date(prev.recordedAt), new Date(curr.recordedAt));

    if (months > 0) {
      velocities.push((curr.rating - prev.rating) / months);
    } else {
      // Same month - use raw difference
      velocities.push(curr.rating - prev.rating);
    }
  }

  return velocities;
}

// ─── Momentum Classification ─────────────────────────────────────────────────

/**
 * Classify player's momentum based on recent rating trend.
 * @param history Sorted rating history (oldest first)
 * @returns 'rising' | 'declining' | 'plateau'
 */
export function classifyMomentum(history: RatingEntry[]): MomentumClassification {
  const velocity = computeVelocity(history, 6); // Use 6-month window for momentum

  if (velocity > 3) return "rising";
  if (velocity < -3) return "declining";
  return "plateau";
}

// ─── Peak Rating ─────────────────────────────────────────────────────────────

/**
 * Find the peak (highest) rating in player's history.
 * @param history Rating history
 * @returns Peak rating and date
 */
export function findPeakRating(history: RatingEntry[]): PeakRating {
  if (history.length === 0) {
    return { rating: 0, date: new Date() };
  }

  let peak = history[0];
  for (const entry of history) {
    if (entry.rating > peak.rating) {
      peak = entry;
    }
  }

  return {
    rating: peak.rating,
    date: new Date(peak.recordedAt),
  };
}

/**
 * Calculate months since peak rating was achieved.
 * @param history Rating history
 * @returns Number of months since peak
 */
export function monthsSincePeak(history: RatingEntry[]): number {
  const peak = findPeakRating(history);
  return monthsBetween(peak.date, new Date());
}

// ─── Win Rate by Band ─────────────────────────────────────────────────────────

/**
 * Compute win rate against opponents in different rating bands.
 * Bands: <-200, -200 to -100, -100 to ±100, +100 to +200, >+200
 * @param games Player's game history
 * @param playerRating Player's current rating (for band calculation)
 * @returns Array of win rate bands
 */
export function computeWinRateByBand(
  games: GameEntry[],
  playerRating: number
): WinRateBand[] {
  if (games.length === 0) return [];

  // Define rating difference bands relative to player
  const bands: { label: string; min: number; max: number }[] = [
    { label: "Much weaker (<-200)", min: -Infinity, max: -200 },
    { label: "Weaker (-200 to -100)", min: -200, max: -100 },
    { label: "Similar (±100)", min: -100, max: 100 },
    { label: "Stronger (+100 to +200)", min: 100, max: 200 },
    { label: "Much stronger (>+200)", min: 200, max: Infinity },
  ];

  const results: WinRateBand[] = [];

  for (const band of bands) {
    const bandGames = games.filter((g) => {
      if (!g.opponentRating) return false;
      const diff = g.opponentRating - playerRating;
      return diff > band.min && diff <= band.max;
    });

    if (bandGames.length === 0) continue;

    const wins = bandGames.filter((g) => g.result === "win").length;
    const rate = bandGames.length > 0 ? wins / bandGames.length : 0;

    results.push({
      band: band.label,
      games: bandGames.length,
      wins,
      rate,
    });
  }

  return results;
}

// ─── Tournament Gains ─────────────────────────────────────────────────────────

/**
 * Extract rating gain/loss per tournament.
 * @param tournaments Tournament history with rating changes
 * @returns Array of tournament gains
 */
export function computeTournamentGains(
  tournaments: TournamentEntry[]
): TournamentGain[] {
  return tournaments
    .filter((t) => t.ratingChange !== undefined)
    .map((t) => ({
      name: t.tournamentName,
      date: new Date(t.date),
      gain: t.ratingChange!,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Compute average rating gain per tournament.
 * @param tournaments Tournament history
 * @returns Average gain, or null if no data
 */
export function computeAvgTournamentGain(
  tournaments: TournamentEntry[]
): number | null {
  const gains = tournaments
    .filter((t) => t.ratingChange !== undefined)
    .map((t) => t.ratingChange!);

  if (gains.length === 0) return null;

  return gains.reduce((sum, g) => sum + g, 0) / gains.length;
}

// ─── Milestone Estimation ─────────────────────────────────────────────────────

/**
 * Estimate months to reach target ratings.
 * @param currentRating Current rating
 * @param velocity Points per month
 * @returns Array of milestone estimates
 */
export function computeMilestones(
  currentRating: number,
  velocity: number
): { target: number; estimatedMonths: number | null }[] {
  // Common milestone targets
  const targets = [1400, 1600, 1800, 2000, 2200, 2400];

  return targets
    .filter((t) => t > currentRating) // Only future milestones
    .map((target) => {
      if (velocity <= 0) {
        // Can't reach higher rating with declining/plateau trend
        return { target, estimatedMonths: null };
      }

      const months = (target - currentRating) / velocity;
      return {
        target,
        estimatedMonths: Math.ceil(months),
      };
    });
}

// ─── Full Analytics Computation ──────────────────────────────────────────────

/**
 * Compute all analytics metrics for a player.
 * @param data Deep player data (profile, history, tournaments, games)
 * @returns Complete PlayerAnalytics object
 */
export function computeFullAnalytics(data: DeepPlayerData): PlayerAnalytics {
  const { profile, ratingHistory, tournaments, games } = data;

  // Sort history by date (oldest first)
  const sortedHistory = [...ratingHistory].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  // Basic metrics (Tier 1)
  const velocity = computeVelocity(sortedHistory, 12);
  const velocitySeries = computeVelocitySeries(sortedHistory);
  const momentum = classifyMomentum(sortedHistory);
  const peak = findPeakRating(sortedHistory);

  // Milestones
  const currentRating = profile.israeliRating;
  const milestones = computeMilestones(currentRating, velocity);

  // Efficiency metrics (Tier 2+3)
  const tournamentGains = tournaments.length > 0
    ? computeTournamentGains(tournaments)
    : null;
  const avgRatingGainPerTournament = tournaments.length > 0
    ? computeAvgTournamentGain(tournaments)
    : null;
  const winRateByBand = games.length > 0
    ? computeWinRateByBand(games, currentRating)
    : null;

  // Predictions will be computed by prediction.ts module (Task 1.3)
  // For now, return null placeholders
  return {
    velocity,
    velocitySeries,
    momentum,
    peakRating: peak.rating,
    peakDate: peak.date,
    monthsSincePeak: monthsSincePeak(sortedHistory),

    // Predictions (to be implemented in Task 1.3)
    prediction3mo: null,
    prediction6mo: null,
    prediction12mo: null,
    milestones,

    // Efficiency
    avgRatingGainPerTournament,
    tournamentGains,
    winRateByBand,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate the number of months between two dates.
 */
function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();

  let total = years * 12 + months;
  if (days < 0) total -= 0.5; // Partial month adjustment

  return Math.max(0, total);
}
