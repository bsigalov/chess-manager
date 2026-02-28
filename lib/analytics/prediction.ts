/**
 * prediction.ts
 * Rating prediction using weighted linear regression with exponential decay.
 * Recent data points are weighted more heavily than older ones.
 */

import type { RatingEntry } from "@/lib/scrapers/chess-org-il";
import type { Prediction } from "./player-analytics";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Decay rate for exponential weighting (higher = faster decay of old data) */
const DECAY_LAMBDA = 0.1;

/** Minimum data points required for regression */
const MIN_DATA_POINTS = 3;

/** Z-score for 95% confidence interval */
const Z_95 = 1.96;

/** Minimum slope (pts/mo) to consider "rising" for milestone estimation */
const MIN_RISING_SLOPE = 3;

// ─── Weighted Linear Regression ─────────────────────────────────────────────────

export interface RegressionResult {
  slope: number;     // points per month
  intercept: number; // rating at x=0 (now)
  r2: number;        // coefficient of determination (fit quality)
  stderr: number;    // standard error of the estimate
}

/**
 * Perform weighted linear regression on rating history.
 * Uses exponential weighting so recent points matter more.
 *
 * @param points Array of {x, y} where x is months-from-now (negative = past), y is rating
 * @param weights Optional custom weights (default: exponential decay)
 * @returns Regression coefficients and statistics
 */
export function weightedLinearRegression(
  points: { x: number; y: number }[],
  weights?: number[]
): RegressionResult {
  const n = points.length;

  if (n < MIN_DATA_POINTS) {
    // Not enough data - return zero slope
    return {
      slope: 0,
      intercept: points.length > 0 ? points[points.length - 1].y : 0,
      r2: 0,
      stderr: 0,
    };
  }

  // Compute weights if not provided (exponential decay)
  const w =
    weights ||
    points.map((p) => {
      // x is months-from-now (negative for past)
      // Weight recent points higher
      return Math.exp(DECAY_LAMBDA * p.x); // exp(0.1 * -12) for 12 months ago
    });

  // Weighted sums
  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXY = 0;
  let sumWX2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    const wi = w[i];
    sumW += wi;
    sumWX += wi * x;
    sumWY += wi * y;
    sumWXY += wi * x * y;
    sumWX2 += wi * x * x;
  }

  // Solve for slope and intercept using weighted least squares
  const denom = sumW * sumWX2 - sumWX * sumWX;
  if (Math.abs(denom) < 1e-10) {
    // Degenerate case
    return {
      slope: 0,
      intercept: sumWY / sumW,
      r2: 0,
      stderr: 0,
    };
  }

  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY * sumWX2 - sumWX * sumWXY) / denom;

  // Calculate R² (weighted coefficient of determination)
  const yMean = sumWY / sumW;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    const wi = w[i];
    const yPred = slope * x + intercept;
    ssTot += wi * (y - yMean) ** 2;
    ssRes += wi * (y - yPred) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Standard error of estimate
  const stderr = Math.sqrt(ssRes / (sumW * (1 - 2 / n)));

  return { slope, intercept, r2, stderr: isNaN(stderr) ? 0 : stderr };
}

// ─── Rating Prediction ────────────────────────────────────────────────────────

/**
 * Predict future rating using weighted linear regression.
 *
 * @param history Sorted rating history (oldest first)
 * @param monthsForward Months into the future to predict
 * @returns Prediction with rating, confidence bounds, slope, and R²
 */
export function predictRating(
  history: RatingEntry[],
  monthsForward: number
): Prediction | null {
  if (history.length < MIN_DATA_POINTS) return null;

  const now = new Date();
  const points = historyToPoints(history, now);

  const reg = weightedLinearRegression(points);

  // Predict at x = monthsForward
  const predicted = reg.intercept + reg.slope * monthsForward;

  // Confidence interval widens with forecast distance
  // Standard error of prediction = stderr * sqrt(1 + 1/n + (x - xMean)² / Σ(xi - xMean)²)
  const n = points.length;
  const xMean = points.reduce((s, p) => s + p.x, 0) / n;
  const xVar = points.reduce((s, p) => s + (p.x - xMean) ** 2, 0);
  const sePred = reg.stderr * Math.sqrt(1 + 1 / n + (monthsForward - xMean) ** 2 / (xVar || 1));

  const margin = Z_95 * sePred;

  return {
    rating: Math.round(predicted),
    low: Math.round(predicted - margin),
    high: Math.round(predicted + margin),
    slope: reg.slope,
    r2: reg.r2,
  };
}

/**
 * Estimate months to reach a target rating.
 *
 * @param history Sorted rating history (oldest first)
 * @param targetRating Target rating to reach
 * @returns Estimated months, or null if unreachable (declining/plateau)
 */
export function predictMilestone(
  history: RatingEntry[],
  targetRating: number
): number | null {
  if (history.length < MIN_DATA_POINTS) return null;

  const now = new Date();
  const points = historyToPoints(history, now);
  const reg = weightedLinearRegression(points);

  // Current predicted rating (at x=0)
  const current = reg.intercept;

  // If target is already reached, return 0
  if (current >= targetRating) return 0;

  // If not significantly rising, can't reach target
  // Use same threshold as momentum classification (3 pts/mo)
  if (reg.slope <= MIN_RISING_SLOPE) return null;

  // Solve: target = intercept + slope * x
  // x = (target - intercept) / slope
  const months = (targetRating - current) / reg.slope;

  return Math.ceil(months);
}

// ─── Peer Crossing Prediction ─────────────────────────────────────────────────

export interface CrossingPrediction {
  monthsUntilCrossing: number;
  crossingRating: number;
  crossingDate: Date;
  confidence: number; // Based on R² of both regressions
}

/**
 * Predict when player A will catch up to (or be caught by) player B.
 *
 * @param historyA Rating history for player A
 * @param historyB Rating history for player B
 * @returns Crossing prediction, or null if no crossing expected
 */
export function predictCrossing(
  historyA: RatingEntry[],
  historyB: RatingEntry[]
): CrossingPrediction | null {
  if (historyA.length < MIN_DATA_POINTS || historyB.length < MIN_DATA_POINTS) {
    return null;
  }

  const now = new Date();
  const pointsA = historyToPoints(historyA, now);
  const pointsB = historyToPoints(historyB, now);

  const regA = weightedLinearRegression(pointsA);
  const regB = weightedLinearRegression(pointsB);

  // Lines: yA = slopeA * x + interceptA
  //        yB = slopeB * x + interceptB
  // Crossing: slopeA * x + interceptA = slopeB * x + interceptB
  //           x = (interceptB - interceptA) / (slopeA - slopeB)

  const slopeDiff = regA.slope - regB.slope;

  // If slopes are parallel (or nearly so), no crossing
  if (Math.abs(slopeDiff) < 0.01) return null;

  const months = (regB.intercept - regA.intercept) / slopeDiff;

  // Only interested in future crossings
  if (months <= 0) return null;

  // Calculate crossing rating
  const crossingRating = regA.intercept + regA.slope * months;

  // Crossing date
  const crossingDate = new Date(now);
  crossingDate.setMonth(crossingDate.getMonth() + Math.round(months));

  // Confidence based on both regressions' R²
  const confidence = Math.sqrt(regA.r2 * regB.r2);

  return {
    monthsUntilCrossing: Math.round(months),
    crossingRating: Math.round(crossingRating),
    crossingDate,
    confidence,
  };
}

// ─── Batch Predictions ────────────────────────────────────────────────────────

/**
 * Compute all prediction horizons (3mo, 6mo, 12mo) at once.
 *
 * @param history Sorted rating history
 * @returns Object with predictions at each horizon
 */
export function computePredictions(history: RatingEntry[]): {
  prediction3mo: Prediction | null;
  prediction6mo: Prediction | null;
  prediction12mo: Prediction | null;
} {
  return {
    prediction3mo: predictRating(history, 3),
    prediction6mo: predictRating(history, 6),
    prediction12mo: predictRating(history, 12),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert rating history to regression points where x = months from now.
 */
function historyToPoints(
  history: RatingEntry[],
  now: Date
): { x: number; y: number }[] {
  return history.map((h) => {
    const date = new Date(h.recordedAt);
    const months = monthsBetween(date, now);
    return { x: -months, y: h.rating }; // Negative because past
  });
}

/**
 * Calculate months between two dates.
 */
function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();

  let total = years * 12 + months;
  if (days < 0) total -= 0.5;

  return Math.max(0, total);
}
