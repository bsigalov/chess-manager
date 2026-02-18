import type {
  CrosstableEntry,
  PlayerRoundResult,
  HypotheticalResult,
} from "@/lib/types/tournament";
import {
  applyHypotheticalResults,
  whatDoesPlayerNeed,
} from "@/lib/analytics/what-if";

// ─── Mock tiebreaks so computeStandings is deterministic ─────
jest.mock("@/lib/analytics/tiebreaks", () => ({
  buchholz: (playerRank: number, crosstable: CrosstableEntry[]) => {
    const player = crosstable.find((e) => e.startingRank === playerRank);
    if (!player) return 0;
    let sum = 0;
    for (const rr of player.roundResults) {
      if (rr.opponentRank === null) continue;
      const opp = crosstable.find((e) => e.startingRank === rr.opponentRank);
      if (opp) sum += opp.points;
    }
    return sum;
  },
  sonnebornBerger: (playerRank: number, crosstable: CrosstableEntry[]) => {
    const player = crosstable.find((e) => e.startingRank === playerRank);
    if (!player) return 0;
    let sum = 0;
    for (const rr of player.roundResults) {
      if (rr.opponentRank === null) continue;
      const opp = crosstable.find((e) => e.startingRank === rr.opponentRank);
      if (opp) sum += rr.score * opp.points;
    }
    return sum;
  },
}));

// ─── Helper to build round results ──────────────────────────
function makeRound(
  round: number,
  opponentRank: number | null,
  color: "w" | "b" | null,
  score: number
): PlayerRoundResult {
  return {
    round,
    opponentRank,
    color,
    score,
    isForfeit: false,
    isBye: false,
  };
}

// ─── 4-player, 3-round crosstable with 2 rounds complete ────
// Round 1: P1(w) beats P2(b), P3(w) beats P4(b)
// Round 2: P1(w) beats P3(b), P2(w) draws P4(b)
// Round 3: not yet played
//
// After 2 rounds: P1=2, P2=0.5, P3=1, P4=0.5

function buildCrosstable(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Alpha",
      title: "GM",
      rating: 2500,
      federation: "ISR",
      points: 2, // W, W
      roundResults: [
        makeRound(1, 2, "w", 1),
        makeRound(2, 3, "w", 1),
      ],
    },
    {
      startingRank: 2,
      name: "Beta",
      title: "IM",
      rating: 2400,
      federation: "RUS",
      points: 0.5, // L, D
      roundResults: [
        makeRound(1, 1, "b", 0),
        makeRound(2, 4, "w", 0.5),
      ],
    },
    {
      startingRank: 3,
      name: "Gamma",
      title: null,
      rating: 2300,
      federation: "USA",
      points: 1, // W, L
      roundResults: [
        makeRound(1, 4, "w", 1),
        makeRound(2, 1, "b", 0),
      ],
    },
    {
      startingRank: 4,
      name: "Delta",
      title: null,
      rating: 2200,
      federation: "GER",
      points: 0.5, // L, D
      roundResults: [
        makeRound(1, 3, "b", 0),
        makeRound(2, 2, "b", 0.5),
      ],
    },
  ];
}

// ─── Tests: applyHypotheticalResults ─────────────────────────

describe("applyHypotheticalResults", () => {
  it("updates both player and opponent for a hypothetical round", () => {
    const original = buildCrosstable();
    const hyp: HypotheticalResult[] = [
      { round: 3, playerRank: 1, opponentRank: 4, score: 1 },
    ];

    const result = applyHypotheticalResults(original, hyp);

    const player1 = result.find((e) => e.startingRank === 1)!;
    const player4 = result.find((e) => e.startingRank === 4)!;

    // Player 1 should have a round 3 result with score 1
    const p1r3 = player1.roundResults.find((rr) => rr.round === 3);
    expect(p1r3).toBeDefined();
    expect(p1r3!.score).toBe(1);
    expect(p1r3!.opponentRank).toBe(4);

    // Player 4 should have a round 3 result with score 0 (inverse)
    const p4r3 = player4.roundResults.find((rr) => rr.round === 3);
    expect(p4r3).toBeDefined();
    expect(p4r3!.score).toBe(0);
    expect(p4r3!.opponentRank).toBe(1);
  });

  it("recalculates points correctly after applying hypotheticals", () => {
    const original = buildCrosstable();
    const hyp: HypotheticalResult[] = [
      { round: 3, playerRank: 1, opponentRank: 4, score: 1 },
      { round: 3, playerRank: 3, opponentRank: 2, score: 0.5 },
    ];

    const result = applyHypotheticalResults(original, hyp);

    // P1: 2 (existing) + 1 (win) = 3
    expect(result.find((e) => e.startingRank === 1)!.points).toBe(3);
    // P4: 0.5 (existing) + 0 (loss) = 0.5
    expect(result.find((e) => e.startingRank === 4)!.points).toBe(0.5);
    // P3: 1 (existing) + 0.5 (draw) = 1.5
    expect(result.find((e) => e.startingRank === 3)!.points).toBe(1.5);
    // P2: 0.5 (existing) + 0.5 (draw) = 1
    expect(result.find((e) => e.startingRank === 2)!.points).toBe(1);
  });

  it("does not mutate the original crosstable", () => {
    const original = buildCrosstable();
    const originalP1Points = original.find((e) => e.startingRank === 1)!.points;
    const originalP1Rounds = original.find((e) => e.startingRank === 1)!.roundResults.length;

    const hyp: HypotheticalResult[] = [
      { round: 3, playerRank: 1, opponentRank: 4, score: 1 },
    ];

    applyHypotheticalResults(original, hyp);

    // Original should be untouched
    expect(original.find((e) => e.startingRank === 1)!.points).toBe(originalP1Points);
    expect(original.find((e) => e.startingRank === 1)!.roundResults.length).toBe(originalP1Rounds);
  });

  it("replaces an existing round result if the round already exists", () => {
    const original = buildCrosstable();
    // Override round 2 for player 1 (originally a win vs P3) to a loss
    const hyp: HypotheticalResult[] = [
      { round: 2, playerRank: 1, opponentRank: 3, score: 0 },
    ];

    const result = applyHypotheticalResults(original, hyp);

    const player1 = result.find((e) => e.startingRank === 1)!;
    // Round 2 should now be a loss
    const p1r2 = player1.roundResults.find((rr) => rr.round === 2);
    expect(p1r2!.score).toBe(0);
    // Points: 1 (R1 win) + 0 (R2 loss) = 1
    expect(player1.points).toBe(1);

    // Opponent (P3) round 2 should now be a win
    const player3 = result.find((e) => e.startingRank === 3)!;
    const p3r2 = player3.roundResults.find((rr) => rr.round === 2);
    expect(p3r2!.score).toBe(1);
    // Points: 1 (R1 win) + 1 (R2 win) = 2
    expect(player3.points).toBe(2);
  });
});

// ─── Tests: whatDoesPlayerNeed ────────────────────────────────

describe("whatDoesPlayerNeed", () => {
  it("reports player already at target position", () => {
    const ct = buildCrosstable();
    // P1 is at position 1 after 2 rounds with 2 pts
    const result = whatDoesPlayerNeed(1, ct, 3, 1);
    expect(result).toBe("Already at position 1");
  });

  it("reports mathematically impossible when player cannot reach target", () => {
    const ct = buildCrosstable();
    // P4 has 0.5 pts, 1 remaining game => max 1.5 pts
    // P1 has 2 pts => 1.5 < 2 => impossible
    const result = whatDoesPlayerNeed(4, ct, 3, 1);
    expect(result).toBe("Cannot reach position 1");
  });

  it("returns needed points from remaining games", () => {
    const ct = buildCrosstable();
    // P3 has 1 pt, 1 remaining game => max 2 pts
    // P1 has 2 pts at position 1 => needs 2 - 1 = 1 point from 1 game
    const result = whatDoesPlayerNeed(3, ct, 3, 1);
    expect(result).toBe("Needs 1 points from 1 remaining games");
  });

  it("returns not found for non-existent player", () => {
    const ct = buildCrosstable();
    const result = whatDoesPlayerNeed(99, ct, 3, 1);
    expect(result).toBe("Player with starting rank 99 not found");
  });
});
