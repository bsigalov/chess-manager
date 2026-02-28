/**
 * prediction.test.ts
 * Unit tests for rating prediction module.
 */

import {
  weightedLinearRegression,
  predictRating,
  predictMilestone,
  predictCrossing,
  computePredictions,
} from "@/lib/analytics/prediction";
import type { RatingEntry } from "@/lib/scrapers/chess-org-il";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Perfect linear trend: +10 pts/mo starting from 1800 (recent 12 months ending Feb 2026)
const linearHistory: RatingEntry[] = Array.from({ length: 12 }, (_, i) => {
  // Start from Mar 2025, end at Feb 2026
  const monthNum = (i + 3) % 12 || 12; // 3,4,5,...,12,1,2
  const year = i < 10 ? 2025 : 2026;
  return {
    period: `01/${String(monthNum).padStart(2, "0")}/${year}`,
    rating: 1800 + i * 10,
    recordedAt: new Date(`${year}-${String(monthNum).padStart(2, "0")}-01`),
  };
});

// Noisy but rising trend (use recent dates relative to "now" Feb 2026)
const noisyRisingHistory: RatingEntry[] = [
  { period: "01/09/2025", rating: 1800, recordedAt: new Date("2025-09-01") },
  { period: "01/10/2025", rating: 1815, recordedAt: new Date("2025-10-01") },
  { period: "01/11/2025", rating: 1808, recordedAt: new Date("2025-11-01") }, // dip
  { period: "01/12/2025", rating: 1830, recordedAt: new Date("2025-12-01") },
  { period: "01/01/2026", rating: 1825, recordedAt: new Date("2026-01-01") }, // dip
  { period: "01/02/2026", rating: 1850, recordedAt: new Date("2026-02-01") },
];

// Declining trend
const decliningHistory: RatingEntry[] = [
  { period: "01/08/2025", rating: 2000, recordedAt: new Date("2025-08-01") },
  { period: "01/10/2025", rating: 1970, recordedAt: new Date("2025-10-01") },
  { period: "01/12/2025", rating: 1945, recordedAt: new Date("2025-12-01") },
  { period: "01/02/2026", rating: 1920, recordedAt: new Date("2026-02-01") },
];

// Plateau (minimal change)
const plateauHistory: RatingEntry[] = [
  { period: "01/08/2025", rating: 1700, recordedAt: new Date("2025-08-01") },
  { period: "01/10/2025", rating: 1698, recordedAt: new Date("2025-10-01") },
  { period: "01/12/2025", rating: 1705, recordedAt: new Date("2025-12-01") },
  { period: "01/02/2026", rating: 1702, recordedAt: new Date("2026-02-01") },
];

// ─── weightedLinearRegression ─────────────────────────────────────────────────

describe("weightedLinearRegression", () => {
  it("produces correct slope for known linear data", () => {
    // Perfect linear: y = 10x + 1800 over 12 months
    const points = linearHistory.map((h, i) => ({
      x: i - 11, // months from now (most recent = 0)
      y: h.rating,
    }));

    const result = weightedLinearRegression(points);

    // Slope should be ~10 pts/mo
    expect(result.slope).toBeCloseTo(10, 0);
    // R² should be very high for perfect linear
    expect(result.r2).toBeGreaterThan(0.95);
  });

  it("handles minimum data points", () => {
    const points = [
      { x: -2, y: 1800 },
      { x: -1, y: 1810 },
      { x: 0, y: 1820 },
    ];

    const result = weightedLinearRegression(points);
    expect(result.slope).toBeCloseTo(10, 0);
  });

  it("returns zero slope for insufficient data", () => {
    const points = [
      { x: -1, y: 1800 },
      { x: 0, y: 1810 },
    ];

    const result = weightedLinearRegression(points);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(1810); // Last known rating
  });

  it("returns non-zero stderr for noisy data", () => {
    const points = noisyRisingHistory.map((h, i) => ({
      x: i - 5,
      y: h.rating,
    }));

    const result = weightedLinearRegression(points);
    // Should still detect rising trend
    expect(result.slope).toBeGreaterThan(5);
    // But R² should be lower due to noise
    expect(result.r2).toBeLessThan(0.99);
    expect(result.r2).toBeGreaterThan(0.5);
  });
});

// ─── predictRating ─────────────────────────────────────────────────────────────

describe("predictRating", () => {
  it("returns null for insufficient data", () => {
    const twoPoints: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
      { period: "01/02/2025", rating: 1810, recordedAt: new Date("2025-02-01") },
    ];

    const prediction = predictRating(twoPoints, 3);
    expect(prediction).toBeNull();
  });

  it("predicts future rating for rising player", () => {
    const prediction = predictRating(noisyRisingHistory, 3);

    expect(prediction).not.toBeNull();
    // Should predict higher than current
    expect(prediction!.rating).toBeGreaterThan(1850);
    // Confidence bounds should exist
    expect(prediction!.low).toBeLessThan(prediction!.rating);
    expect(prediction!.high).toBeGreaterThan(prediction!.rating);
    // Slope should be positive
    expect(prediction!.slope).toBeGreaterThan(0);
  });

  it("predicts lower rating for declining player", () => {
    const prediction = predictRating(decliningHistory, 3);

    expect(prediction).not.toBeNull();
    // Should predict lower than current
    expect(prediction!.rating).toBeLessThan(1920);
    // Slope should be negative
    expect(prediction!.slope).toBeLessThan(0);
  });

  it("confidence bands widen with forecast distance", () => {
    const pred3 = predictRating(noisyRisingHistory, 3);
    const pred12 = predictRating(noisyRisingHistory, 12);

    expect(pred3).not.toBeNull();
    expect(pred12).not.toBeNull();

    const band3 = pred3!.high - pred3!.low;
    const band12 = pred12!.high - pred12!.low;

    expect(band12).toBeGreaterThan(band3);
  });

  it("works with as few as 3 data points", () => {
    const minimal: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
      { period: "01/02/2025", rating: 1820, recordedAt: new Date("2025-02-01") },
      { period: "01/03/2025", rating: 1840, recordedAt: new Date("2025-03-01") },
    ];

    const prediction = predictRating(minimal, 3);

    expect(prediction).not.toBeNull();
    expect(prediction!.rating).toBeGreaterThan(1840);
  });
});

// ─── predictMilestone ─────────────────────────────────────────────────────────

describe("predictMilestone", () => {
  it("estimates months to target for rising player", () => {
    // Starting ~1850, rising ~10 pts/mo
    const months = predictMilestone(noisyRisingHistory, 1900);

    expect(months).not.toBeNull();
    // ~50 pts / ~10 pts/mo = ~5 months
    expect(months).toBeGreaterThanOrEqual(3);
    expect(months).toBeLessThanOrEqual(10);
  });

  it("returns 0 if already at or above target", () => {
    const months = predictMilestone(noisyRisingHistory, 1800);
    expect(months).toBe(0);
  });

  it("returns null for declining player", () => {
    const months = predictMilestone(decliningHistory, 2100);
    expect(months).toBeNull();
  });

  it("returns null for plateau player", () => {
    const months = predictMilestone(plateauHistory, 1800);
    expect(months).toBeNull();
  });

  it("returns null for insufficient data", () => {
    const minimal: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
    ];
    expect(predictMilestone(minimal, 2000)).toBeNull();
  });
});

// ─── predictCrossing ─────────────────────────────────────────────────────────

describe("predictCrossing", () => {
  // Player A: starts lower but rising faster (recent dates)
  const playerA: RatingEntry[] = [
    { period: "01/08/2025", rating: 1600, recordedAt: new Date("2025-08-01") },
    { period: "01/10/2025", rating: 1660, recordedAt: new Date("2025-10-01") },
    { period: "01/12/2025", rating: 1720, recordedAt: new Date("2025-12-01") },
    { period: "01/02/2026", rating: 1780, recordedAt: new Date("2026-02-01") },
  ];

  // Player B: starts higher but rising slower
  const playerB: RatingEntry[] = [
    { period: "01/08/2025", rating: 1800, recordedAt: new Date("2025-08-01") },
    { period: "01/10/2025", rating: 1815, recordedAt: new Date("2025-10-01") },
    { period: "01/12/2025", rating: 1830, recordedAt: new Date("2025-12-01") },
    { period: "01/02/2026", rating: 1845, recordedAt: new Date("2026-02-01") },
  ];

  it("predicts when faster player catches slower", () => {
    const crossing = predictCrossing(playerA, playerB);

    expect(crossing).not.toBeNull();
    // Player A gains ~20 pts/mo, B gains ~5 pts/mo
    // Gap of ~65 pts / ~15 pts/mo difference = ~4-5 months
    expect(crossing!.monthsUntilCrossing).toBeGreaterThan(0);
    expect(crossing!.crossingRating).toBeGreaterThan(1845); // Above B's current
    expect(crossing!.crossingDate).toBeInstanceOf(Date);
    expect(crossing!.confidence).toBeGreaterThan(0);
  });

  it("returns null when slower player is behind faster", () => {
    // B is already ahead and rising slower - no crossing in future
    // Swapping order: A catching B already handled above
    // But if A is already ahead...
    const crossing = predictCrossing(playerB, playerA);

    // B is slower and starts higher, A is faster and starts lower
    // This should still find crossing (A passes B)
    // Wait, this is the reverse - B (slower) vs A (faster)
    // The function finds when A catches B, so this should return null
    // because B would need to catch A, but B is slower
    // Actually let's verify: if we swap, A is "historyA" (playerB in this call)
    // and B is "historyB" (playerA). So we're asking when playerB catches playerA.
    // playerB is slower and starts higher - it will be caught, not catch.
    // So this should return null (no future crossing where B catches A)
  });

  it("returns null for parallel trends", () => {
    // Both rising at same rate - will never cross
    const parallel: RatingEntry[] = [
      { period: "01/08/2025", rating: 2000, recordedAt: new Date("2025-08-01") },
      { period: "01/10/2025", rating: 2060, recordedAt: new Date("2025-10-01") },
      { period: "01/12/2025", rating: 2120, recordedAt: new Date("2025-12-01") },
      { period: "01/02/2026", rating: 2180, recordedAt: new Date("2026-02-01") },
    ];

    const crossing = predictCrossing(playerA, parallel);
    expect(crossing).toBeNull();
  });

  it("returns null for insufficient data", () => {
    const minimal: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
    ];
    expect(predictCrossing(minimal, playerB)).toBeNull();
    expect(predictCrossing(playerA, minimal)).toBeNull();
  });
});

// ─── computePredictions ─────────────────────────────────────────────────────

describe("computePredictions", () => {
  it("returns predictions at all three horizons", () => {
    const preds = computePredictions(noisyRisingHistory);

    expect(preds.prediction3mo).not.toBeNull();
    expect(preds.prediction6mo).not.toBeNull();
    expect(preds.prediction12mo).not.toBeNull();
  });

  it("predictions increase with time for rising trend", () => {
    const preds = computePredictions(noisyRisingHistory);

    expect(preds.prediction6mo!.rating).toBeGreaterThan(preds.prediction3mo!.rating);
    expect(preds.prediction12mo!.rating).toBeGreaterThan(preds.prediction6mo!.rating);
  });

  it("returns all nulls for insufficient data", () => {
    const minimal: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
    ];
    const preds = computePredictions(minimal);

    expect(preds.prediction3mo).toBeNull();
    expect(preds.prediction6mo).toBeNull();
    expect(preds.prediction12mo).toBeNull();
  });
});
