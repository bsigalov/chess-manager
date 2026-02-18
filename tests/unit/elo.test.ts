import {
  expectedScore,
  kFactor,
  ratingChange,
  computeRatingProgression,
  winDrawLossProbability,
  performanceRating,
} from "@/lib/analytics/elo";

describe("expectedScore", () => {
  it("returns ~0.9091 for 2400 vs 2000", () => {
    const result = expectedScore(2400, 2000);
    expect(result).toBeCloseTo(0.9091, 4);
  });

  it("returns ~0.0909 for 2000 vs 2400 (inverse)", () => {
    const result = expectedScore(2000, 2400);
    expect(result).toBeCloseTo(0.0909, 4);
  });

  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 4);
  });

  it("expected scores of both players sum to 1.0", () => {
    const a = expectedScore(2200, 1800);
    const b = expectedScore(1800, 2200);
    expect(a + b).toBeCloseTo(1.0, 10);
  });
});

describe("kFactor", () => {
  it("returns 40 for rating below 2300", () => {
    expect(kFactor(1500)).toBe(40);
    expect(kFactor(2299)).toBe(40);
  });

  it("returns 20 for rating 2300-2399", () => {
    expect(kFactor(2300)).toBe(20);
    expect(kFactor(2399)).toBe(20);
  });

  it("returns 10 for rating 2400+", () => {
    expect(kFactor(2400)).toBe(10);
    expect(kFactor(2800)).toBe(10);
  });
});

describe("ratingChange", () => {
  it("positive change on upset win (lower rated beats higher)", () => {
    const change = ratingChange(2000, 2400, 1);
    expect(change).toBeGreaterThan(0);
    // K=40, expected ~0.0909, change = 40 * (1 - 0.0909) ≈ 36.36
    expect(change).toBeCloseTo(40 * (1 - 0.0909), 1);
  });

  it("negative change on expected loss", () => {
    const change = ratingChange(2000, 2400, 0);
    expect(change).toBeLessThan(0);
  });

  it("near-zero change for expected draw between equal players", () => {
    const change = ratingChange(1500, 1500, 0.5);
    expect(change).toBeCloseTo(0, 4);
  });

  it("uses correct K-factor for high-rated player", () => {
    // 2500-rated player, K=10
    const change = ratingChange(2500, 2500, 1);
    // K=10, expected=0.5, change = 10 * 0.5 = 5
    expect(change).toBeCloseTo(5, 4);
  });
});

describe("computeRatingProgression", () => {
  it("returns correct running totals for a series of games", () => {
    const games = [
      { opponentRating: 2000, result: 1, round: 1 },
      { opponentRating: 2200, result: 0.5, round: 2 },
      { opponentRating: 1800, result: 0, round: 3 },
    ];

    const steps = computeRatingProgression(2000, games);
    expect(steps).toHaveLength(3);

    // Round 1: 2000 vs 2000, win. expected=0.5, change=40*0.5=20
    expect(steps[0].round).toBe(1);
    expect(steps[0].expectedScore).toBeCloseTo(0.5, 4);
    expect(steps[0].ratingChange).toBeCloseTo(20, 1);
    expect(steps[0].ratingAfter).toBeCloseTo(2020, 1);

    // Round 2: ~2020 vs 2200, draw
    expect(steps[1].round).toBe(2);
    expect(steps[1].ratingAfter).toBeGreaterThan(2020); // draw vs higher = small gain

    // Round 3: rating vs 1800, loss
    expect(steps[2].round).toBe(3);
    expect(steps[2].ratingChange).toBeLessThan(0);
  });

  it("skips BYEs (null opponentRating) with zero change", () => {
    const games = [
      { opponentRating: 2000, result: 1, round: 1 },
      { opponentRating: null, result: 1, round: 2 },
      { opponentRating: 2000, result: 1, round: 3 },
    ];

    const steps = computeRatingProgression(2000, games);
    expect(steps).toHaveLength(3);

    // BYE round
    expect(steps[1].opponentRating).toBeNull();
    expect(steps[1].ratingChange).toBe(0);
    expect(steps[1].ratingAfter).toBe(steps[0].ratingAfter);
  });
});

describe("winDrawLossProbability", () => {
  it("probabilities sum to approximately 1.0", () => {
    const { win, draw, loss } = winDrawLossProbability(2400, 2000);
    expect(win + draw + loss).toBeCloseTo(1.0, 10);
  });

  it("equal ratings: draw rate ~33%, white slight edge", () => {
    const { win, draw, loss } = winDrawLossProbability(1500, 1500);
    expect(draw).toBeGreaterThan(0.3);
    expect(draw).toBeLessThan(0.51);
    // White has slight advantage from the 50 Elo bonus
    expect(win).toBeGreaterThan(loss);
  });

  it("strong favorite has higher win probability", () => {
    const { win, loss } = winDrawLossProbability(2600, 2000);
    expect(win).toBeGreaterThan(0.7);
    expect(loss).toBeLessThan(0.1);
  });

  it("all probabilities are non-negative", () => {
    const { win, draw, loss } = winDrawLossProbability(1000, 2800);
    expect(win).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(loss).toBeGreaterThanOrEqual(0);
  });
});

describe("performanceRating", () => {
  it("computes correct TPR for mixed results", () => {
    // 3 games: avg opponent = 2000, score = 2.5/3 (win, draw, win)
    // (2*2.5 - 3)/3 = 2/3
    // TPR = 2000 + 400 * (2/3) ≈ 2266.67
    const results = [
      { opponentRating: 2000, result: 1 },
      { opponentRating: 2000, result: 0.5 },
      { opponentRating: 2000, result: 1 },
    ];
    expect(performanceRating(results)).toBeCloseTo(2266.67, 0);
  });

  it("caps at +400 for all wins", () => {
    const results = [
      { opponentRating: 2000, result: 1 },
      { opponentRating: 2200, result: 1 },
    ];
    // avg = 2100, all wins -> +400
    expect(performanceRating(results)).toBeCloseTo(2500, 0);
  });

  it("caps at -400 for all losses", () => {
    const results = [
      { opponentRating: 2000, result: 0 },
      { opponentRating: 2200, result: 0 },
    ];
    // avg = 2100, all losses -> -400
    expect(performanceRating(results)).toBeCloseTo(1700, 0);
  });

  it("returns 0 for empty results", () => {
    expect(performanceRating([])).toBe(0);
  });
});
