import { runSimulation } from "@/lib/analytics/monte-carlo";
import type { CrosstableEntry } from "@/lib/types/tournament";

/**
 * Helper: build a 4-player crosstable with 2 completed rounds out of 3 total.
 *
 * Player 1 (2400): 2.0/2 (won both)
 * Player 2 (2200): 1.5/2
 * Player 3 (2000): 0.5/2
 * Player 4 (1800): 0.0/2 (lost both)
 */
function make4PlayerCrosstable(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Player A",
      title: "GM",
      rating: 2400,
      federation: "USA",
      points: 2.0,
      roundResults: [
        { round: 1, opponentRank: 2, color: "w", score: 1, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 3, color: "b", score: 1, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 2,
      name: "Player B",
      title: "IM",
      rating: 2200,
      federation: "RUS",
      points: 1.5,
      roundResults: [
        { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 4, color: "w", score: 1.0, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 3,
      name: "Player C",
      title: null,
      rating: 2000,
      federation: "ISR",
      points: 0.5,
      roundResults: [
        { round: 1, opponentRank: 4, color: "w", score: 0.5, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 1, color: "w", score: 0, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 4,
      name: "Player D",
      title: null,
      rating: 1800,
      federation: "GER",
      points: 0.0,
      roundResults: [
        { round: 1, opponentRank: 3, color: "b", score: 0.5, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 2, color: "b", score: 0, isForfeit: false, isBye: false },
      ],
    },
  ];
}

/** Build the same 4-player crosstable but with all 3 rounds completed. */
function makeCompletedCrosstable(): CrosstableEntry[] {
  const ct = make4PlayerCrosstable();
  // Add round 3 results
  ct[0].roundResults.push({ round: 3, opponentRank: 4, color: "w", score: 1, isForfeit: false, isBye: false });
  ct[0].points = 3.0;
  ct[1].roundResults.push({ round: 3, opponentRank: 3, color: "b", score: 0.5, isForfeit: false, isBye: false });
  ct[1].points = 2.0;
  ct[2].roundResults.push({ round: 3, opponentRank: 2, color: "w", score: 0.5, isForfeit: false, isBye: false });
  ct[2].points = 1.0;
  ct[3].roundResults.push({ round: 3, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false });
  ct[3].points = 0.0;
  return ct;
}

/** Build a 4-player crosstable with unrated players. */
function makeUnratedCrosstable(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Unrated A",
      title: null,
      rating: null,
      federation: null,
      points: 1.0,
      roundResults: [
        { round: 1, opponentRank: 2, color: "w", score: 1, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 2,
      name: "Unrated B",
      title: null,
      rating: null,
      federation: null,
      points: 0.0,
      roundResults: [
        { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 3,
      name: "Unrated C",
      title: null,
      rating: null,
      federation: null,
      points: 0.5,
      roundResults: [
        { round: 1, opponentRank: 4, color: "w", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 4,
      name: "Unrated D",
      title: null,
      rating: null,
      federation: null,
      points: 0.5,
      roundResults: [
        { round: 1, opponentRank: 3, color: "b", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
  ];
}

const ITERATIONS = 1000;
const TOTAL_ROUNDS = 3;

describe("runSimulation", () => {
  it("returns correct player count", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);
    expect(result.players).toHaveLength(4);
    expect(result.totalRounds).toBe(TOTAL_ROUNDS);
    expect(result.completedRounds).toBe(2);
    expect(result.iterations).toBe(ITERATIONS);
  });

  it("position distribution sums to ~1.0 for each position", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    // For each position (column), sum across all players should be ~1.0
    for (let pos = 0; pos < 4; pos++) {
      const sum = result.players.reduce(
        (acc, p) => acc + p.positionDistribution[pos],
        0
      );
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("probFirst values sum to ~1.0 across all players", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    const sumFirst = result.players.reduce((acc, p) => acc + p.probFirst, 0);
    expect(sumFirst).toBeCloseTo(1.0, 1);
  });

  it("expectedPoints are between current points and current + remaining rounds", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    for (const player of result.players) {
      const baseEntry = ct.find(
        (e) => e.startingRank === player.startingRank
      )!;
      const remainingRounds = TOTAL_ROUNDS - 2; // 1 remaining round
      expect(player.expectedPoints).toBeGreaterThanOrEqual(
        baseEntry.points - 0.01
      );
      expect(player.expectedPoints).toBeLessThanOrEqual(
        baseEntry.points + remainingRounds + 0.01
      );
    }
  });

  it("higher-rated leader has highest probFirst", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    const playerA = result.players.find((p) => p.startingRank === 1)!;
    for (const other of result.players) {
      if (other.startingRank !== 1) {
        expect(playerA.probFirst).toBeGreaterThan(other.probFirst);
      }
    }
  });

  it("pointsStdDev is non-negative for all players", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    for (const player of result.players) {
      expect(player.pointsStdDev).toBeGreaterThanOrEqual(0);
    }
  });

  it("completed tournament returns deterministic results", () => {
    const ct = makeCompletedCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    expect(result.iterations).toBe(0);
    expect(result.completedRounds).toBe(3);

    // Player A (3.0 pts) should be first with probability 1
    const playerA = result.players.find((p) => p.startingRank === 1)!;
    expect(playerA.probFirst).toBe(1);
    expect(playerA.expectedPoints).toBe(3.0);
    expect(playerA.pointsStdDev).toBe(0);
    expect(playerA.positionDistribution[0]).toBe(1);

    // Player D (0.0 pts) should be last with probability 1
    const playerD = result.players.find((p) => p.startingRank === 4)!;
    expect(playerD.probFirst).toBe(0);
    expect(playerD.positionDistribution[3]).toBe(1);

    // All probFirst should be exactly 0 or 1, and sum to 1
    const sumFirst = result.players.reduce((acc, p) => acc + p.probFirst, 0);
    expect(sumFirst).toBe(1);

    // All probTop3 should be exactly 0 or 1
    for (const p of result.players) {
      expect(p.probTop3 === 0 || p.probTop3 === 1).toBe(true);
    }
  });

  it("handles unrated players gracefully (defaults to 1500)", () => {
    const ct = makeUnratedCrosstable();
    const result = runSimulation(ct, 3, ITERATIONS);

    expect(result.players).toHaveLength(4);
    expect(result.completedRounds).toBe(1);

    // All results should have valid numbers
    for (const player of result.players) {
      expect(Number.isFinite(player.expectedPoints)).toBe(true);
      expect(Number.isFinite(player.pointsStdDev)).toBe(true);
      expect(Number.isFinite(player.probFirst)).toBe(true);
      expect(player.probFirst).toBeGreaterThanOrEqual(0);
      expect(player.probFirst).toBeLessThanOrEqual(1);
    }

    // Position distribution still sums to ~1.0 per position
    for (let pos = 0; pos < 4; pos++) {
      const sum = result.players.reduce(
        (acc, p) => acc + p.positionDistribution[pos],
        0
      );
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("position distribution length matches player count", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    for (const player of result.players) {
      expect(player.positionDistribution).toHaveLength(4);
      // Each probability between 0 and 1
      for (const prob of player.positionDistribution) {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
      // Player's distribution sums to ~1.0
      const sum = player.positionDistribution.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("probTop3 is >= probFirst for all players", () => {
    const ct = make4PlayerCrosstable();
    const result = runSimulation(ct, TOTAL_ROUNDS, ITERATIONS);

    for (const player of result.players) {
      expect(player.probTop3).toBeGreaterThanOrEqual(player.probFirst - 0.001);
    }
  });
});
