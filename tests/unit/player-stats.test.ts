import { computePlayerStats } from "@/lib/analytics/player-stats";
import type { CrosstableEntry } from "@/lib/types/tournament";

/**
 * Test crosstable: 4 players, 3 rounds
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
      rating: null, // unrated player
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
 * Crosstable with a BYE round for testing BYE handling.
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

describe("computePlayerStats", () => {
  describe("W/D/L counts", () => {
    it("counts wins, draws, losses for Alice", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      expect(stats.wins).toBe(2);
      expect(stats.draws).toBe(1);
      expect(stats.losses).toBe(0);
    });

    it("counts wins, draws, losses for Bob", () => {
      const stats = computePlayerStats(2, makeCrosstable());
      expect(stats.wins).toBe(1);
      expect(stats.draws).toBe(2);
      expect(stats.losses).toBe(0);
    });

    it("counts wins, draws, losses for Diana (all losses)", () => {
      const stats = computePlayerStats(4, makeCrosstable());
      expect(stats.wins).toBe(0);
      expect(stats.draws).toBe(0);
      expect(stats.losses).toBe(3);
    });
  });

  describe("color balance", () => {
    it("tracks white/black games for Alice (2 white, 1 black)", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      expect(stats.whiteGames).toBe(2);
      expect(stats.blackGames).toBe(1);
    });

    it("tracks white/black score for Alice", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      // White: R1 win(1) + R3 win(1) = 2.0
      expect(stats.whiteScore).toBe(2.0);
      // Black: R2 draw(0.5) = 0.5
      expect(stats.blackScore).toBe(0.5);
    });

    it("handles Diana who only played black", () => {
      const stats = computePlayerStats(4, makeCrosstable());
      expect(stats.whiteGames).toBe(0);
      expect(stats.blackGames).toBe(3);
      expect(stats.whiteScore).toBe(0);
      expect(stats.blackScore).toBe(0);
    });
  });

  describe("score progression", () => {
    it("builds cumulative score array for Alice", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      // R1: 1, R2: 1.5, R3: 2.5
      expect(stats.scoreProgression).toEqual([1, 1.5, 2.5]);
    });

    it("has correct length matching number of rounds", () => {
      const stats = computePlayerStats(2, makeCrosstable());
      expect(stats.scoreProgression).toHaveLength(3);
    });

    it("progression for Diana is all zeros", () => {
      const stats = computePlayerStats(4, makeCrosstable());
      expect(stats.scoreProgression).toEqual([0, 0, 0]);
    });
  });

  describe("average opponent rating", () => {
    it("computes average opponent rating for Alice", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      // Opponents: Charlie(1600) + Bob(1800) + Diana(null, unrated)
      // Only rated opponents: (1600 + 1800) / 2 = 1700
      expect(stats.averageOpponentRating).toBe(1700);
    });

    it("returns null when no opponents have ratings", () => {
      // Create a minimal crosstable where the only opponent is unrated
      const ct: CrosstableEntry[] = [
        {
          startingRank: 1,
          name: "X",
          title: null,
          rating: 2000,
          federation: null,
          points: 1,
          roundResults: [
            { round: 1, opponentRank: 2, color: "w", score: 1, isForfeit: false, isBye: false },
          ],
        },
        {
          startingRank: 2,
          name: "Y",
          title: null,
          rating: null,
          federation: null,
          points: 0,
          roundResults: [
            { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
          ],
        },
      ];
      const stats = computePlayerStats(1, ct);
      expect(stats.averageOpponentRating).toBeNull();
    });
  });

  describe("performance rating", () => {
    it("computes performance rating for Alice using 400*(W-L)/N formula", () => {
      const stats = computePlayerStats(1, makeCrosstable());
      // avgOppRating = 1700, W=2, L=0, N=2 (rated opponents only)
      // perfRating = 1700 + 400*(2-0)/2 = 1700 + 400 = 2100
      expect(stats.performanceRating).toBe(2100);
    });

    it("computes performance rating for Charlie", () => {
      const stats = computePlayerStats(3, makeCrosstable());
      // Opponents: Alice(2000) + Diana(null) + Bob(1800)
      // Rated: (2000+1800)/2 = 1900, W=1, L=1, N=2
      // perfRating = 1900 + 400*(1-1)/2 = 1900
      expect(stats.performanceRating).toBe(1900);
    });

    it("returns null when average opponent rating is null", () => {
      const ct: CrosstableEntry[] = [
        {
          startingRank: 1,
          name: "X",
          title: null,
          rating: 2000,
          federation: null,
          points: 1,
          roundResults: [
            { round: 1, opponentRank: 2, color: "w", score: 1, isForfeit: false, isBye: false },
          ],
        },
        {
          startingRank: 2,
          name: "Y",
          title: null,
          rating: null,
          federation: null,
          points: 0,
          roundResults: [
            { round: 1, opponentRank: 1, color: "b", score: 0, isForfeit: false, isBye: false },
          ],
        },
      ];
      const stats = computePlayerStats(1, ct);
      expect(stats.performanceRating).toBeNull();
    });
  });

  describe("BYE handling", () => {
    it("BYE counts as a win but not as a color game", () => {
      const stats = computePlayerStats(1, makeCrosstableWithBye());
      // Alice: R1 win(w), R2 win(b), R3 BYE(win, no color)
      expect(stats.wins).toBe(3);
      expect(stats.whiteGames).toBe(1);
      expect(stats.blackGames).toBe(1);
      // Total games by color = 2, but total rounds = 3
    });

    it("BYE does not affect average opponent rating", () => {
      const stats = computePlayerStats(1, makeCrosstableWithBye());
      // Rated opponents: Bob(1800) + Charlie(1600) => avg 1700
      // BYE is excluded
      expect(stats.averageOpponentRating).toBe(1700);
    });
  });

  describe("error handling", () => {
    it("throws for unknown player rank", () => {
      expect(() => computePlayerStats(99, makeCrosstable())).toThrow(
        "Player with rank 99 not found"
      );
    });
  });
});
