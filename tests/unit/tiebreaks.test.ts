import { buchholz, sonnebornBerger } from "@/lib/analytics/tiebreaks";
import type { CrosstableEntry } from "@/lib/types/tournament";

/**
 * Test crosstable: 4 players, 3 rounds (round-robin)
 *
 * R1: Alice(w) 1-0 Charlie,  Bob(w) 1-0 Diana
 * R2: Alice(b) ½-½ Bob,      Charlie(w) 1-0 Diana
 * R3: Alice(w) 1-0 Diana,    Bob(b) ½-½ Charlie
 *
 * Final: Alice 2.5, Bob 2.0, Charlie 1.5, Diana 0.0
 */
function makeCrosstable(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Alice",
      title: null,
      rating: 2000,
      federation: null,
      points: 2.5,
      roundResults: [
        { round: 1, opponentRank: 3, color: "w", score: 1, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 2, color: "b", score: 0.5, isForfeit: false, isBye: false },
        { round: 3, opponentRank: 4, color: "w", score: 1, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 2,
      name: "Bob",
      title: null,
      rating: 1800,
      federation: null,
      points: 2.0,
      roundResults: [
        { round: 1, opponentRank: 4, color: "w", score: 1, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 1, color: "w", score: 0.5, isForfeit: false, isBye: false },
        { round: 3, opponentRank: 3, color: "b", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 3,
      name: "Charlie",
      title: null,
      rating: 1600,
      federation: null,
      points: 1.5,
      roundResults: [
        { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 4, color: "w", score: 1, isForfeit: false, isBye: false },
        { round: 3, opponentRank: 2, color: "w", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 4,
      name: "Diana",
      title: null,
      rating: 1400,
      federation: null,
      points: 0.0,
      roundResults: [
        { round: 1, opponentRank: 2, color: "b", score: 0, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 3, color: "b", score: 0, isForfeit: false, isBye: false },
        { round: 3, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
      ],
    },
  ];
}

/**
 * Crosstable with a BYE: 3 players, 3 rounds (odd number = one BYE per round)
 *
 * R1: Alice(w) 1-0 Bob,   Charlie gets BYE (1 point)
 * R2: Alice(b) 1-0 Charlie, Bob gets BYE (1 point)
 * R3: Bob(w) ½-½ Charlie,  Alice gets BYE (1 point)
 *
 * Final: Alice 3.0, Bob 1.5, Charlie 1.5
 */
function makeCrosstableWithBye(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Alice",
      title: null,
      rating: 2000,
      federation: null,
      points: 3.0,
      roundResults: [
        { round: 1, opponentRank: 2, color: "w", score: 1, isForfeit: false, isBye: false },
        { round: 2, opponentRank: 3, color: "b", score: 1, isForfeit: false, isBye: false },
        { round: 3, opponentRank: null, color: null, score: 1, isForfeit: false, isBye: true },
      ],
    },
    {
      startingRank: 2,
      name: "Bob",
      title: null,
      rating: 1800,
      federation: null,
      points: 1.5,
      roundResults: [
        { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
        { round: 2, opponentRank: null, color: null, score: 1, isForfeit: false, isBye: true },
        { round: 3, opponentRank: 3, color: "w", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
    {
      startingRank: 3,
      name: "Charlie",
      title: null,
      rating: 1600,
      federation: null,
      points: 1.5,
      roundResults: [
        { round: 1, opponentRank: null, color: null, score: 1, isForfeit: false, isBye: true },
        { round: 2, opponentRank: 1, color: "w", score: 0, isForfeit: false, isBye: false },
        { round: 3, opponentRank: 2, color: "b", score: 0.5, isForfeit: false, isBye: false },
      ],
    },
  ];
}

describe("tiebreaks", () => {
  describe("buchholz", () => {
    it("sums opponents' points for Alice (rank 1)", () => {
      const ct = makeCrosstable();
      // Alice's opponents: Charlie(1.5) + Bob(2.0) + Diana(0.0) = 3.5
      expect(buchholz(1, ct)).toBe(3.5);
    });

    it("sums opponents' points for Bob (rank 2)", () => {
      const ct = makeCrosstable();
      // Bob's opponents: Diana(0.0) + Alice(2.5) + Charlie(1.5) = 4.0
      expect(buchholz(2, ct)).toBe(4.0);
    });

    it("sums opponents' points for Diana (rank 4, all losses)", () => {
      const ct = makeCrosstable();
      // Diana's opponents: Bob(2.0) + Charlie(1.5) + Alice(2.5) = 6.0
      expect(buchholz(4, ct)).toBe(6.0);
    });

    it("substitutes player's own points for BYE rounds", () => {
      const ct = makeCrosstableWithBye();
      // Alice: Bob(1.5) + Charlie(1.5) + BYE(own=3.0) = 6.0
      expect(buchholz(1, ct)).toBe(6.0);
    });

    it("handles BYE for lower-ranked player", () => {
      const ct = makeCrosstableWithBye();
      // Bob: Alice(3.0) + BYE(own=1.5) + Charlie(1.5) = 6.0
      expect(buchholz(2, ct)).toBe(6.0);
    });

    it("throws for unknown player rank", () => {
      const ct = makeCrosstable();
      expect(() => buchholz(99, ct)).toThrow("Player with rank 99 not found");
    });
  });

  describe("sonnebornBerger", () => {
    it("computes SB for Alice (rank 1)", () => {
      const ct = makeCrosstable();
      // Alice: Charlie.pts*1 + Bob.pts*0.5 + Diana.pts*1
      //      = 1.5*1 + 2.0*0.5 + 0.0*1 = 1.5 + 1.0 + 0 = 2.5
      expect(sonnebornBerger(1, ct)).toBe(2.5);
    });

    it("computes SB for Bob (rank 2)", () => {
      const ct = makeCrosstable();
      // Bob: Diana.pts*1 + Alice.pts*0.5 + Charlie.pts*0.5
      //    = 0.0*1 + 2.5*0.5 + 1.5*0.5 = 0 + 1.25 + 0.75 = 2.0
      expect(sonnebornBerger(2, ct)).toBe(2.0);
    });

    it("computes SB for Diana (rank 4, all losses = 0)", () => {
      const ct = makeCrosstable();
      // Diana: all losses, score=0 for every game => SB = 0
      expect(sonnebornBerger(4, ct)).toBe(0);
    });

    it("computes SB for Charlie (rank 3)", () => {
      const ct = makeCrosstable();
      // Charlie: Alice.pts*0 + Diana.pts*1 + Bob.pts*0.5
      //        = 2.5*0 + 0.0*1 + 2.0*0.5 = 0 + 0 + 1.0 = 1.0
      expect(sonnebornBerger(3, ct)).toBe(1.0);
    });

    it("skips BYE rounds (they contribute 0)", () => {
      const ct = makeCrosstableWithBye();
      // Alice: Bob.pts*1 + Charlie.pts*1 + BYE(skipped)
      //      = 1.5*1 + 1.5*1 = 3.0
      expect(sonnebornBerger(1, ct)).toBe(3.0);
    });

    it("throws for unknown player rank", () => {
      const ct = makeCrosstable();
      expect(() => sonnebornBerger(99, ct)).toThrow(
        "Player with rank 99 not found"
      );
    });
  });
});
