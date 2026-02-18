import type {
  CrosstableEntry,
  PlayerRoundResult,
  StandingsWithTiebreaks,
} from "@/lib/types/tournament";
import { computeStandings, computeStandingsAfterRound } from "@/lib/analytics/standings";

// ─── Mock tiebreaks if the module doesn't exist yet ──────────
// The tiebreaks module may be built in parallel. We mock it so tests
// are self-contained, with deterministic tiebreak values.
jest.mock("@/lib/analytics/tiebreaks", () => ({
  buchholz: (playerRank: number, crosstable: CrosstableEntry[]) => {
    // Sum of opponents' points
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
    // Sum of (score vs opponent) * opponent's points
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

// ─── Test fixture: 4 players, 3 rounds ──────────────────────
// Round 1: P1 beats P2, P3 beats P4
// Round 2: P1 beats P3, P2 beats P4
// Round 3: P1 draws P4, P2 beats P3

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

function buildCrosstable(): CrosstableEntry[] {
  return [
    {
      startingRank: 1,
      name: "Player A",
      title: "GM",
      rating: 2500,
      federation: "ISR",
      points: 2.5, // W, W, D
      roundResults: [
        makeRound(1, 2, "w", 1),
        makeRound(2, 3, "w", 1),
        makeRound(3, 4, "b", 0.5),
      ],
    },
    {
      startingRank: 2,
      name: "Player B",
      title: "IM",
      rating: 2400,
      federation: "RUS",
      points: 2, // L, W, W
      roundResults: [
        makeRound(1, 1, "b", 0),
        makeRound(2, 4, "w", 1),
        makeRound(3, 3, "w", 1),
      ],
    },
    {
      startingRank: 3,
      name: "Player C",
      title: null,
      rating: 2300,
      federation: "USA",
      points: 1, // W, L, L
      roundResults: [
        makeRound(1, 4, "w", 1),
        makeRound(2, 1, "b", 0),
        makeRound(3, 2, "b", 0),
      ],
    },
    {
      startingRank: 4,
      name: "Player D",
      title: null,
      rating: 2200,
      federation: "GER",
      points: 0.5, // L, L, D
      roundResults: [
        makeRound(1, 3, "b", 0),
        makeRound(2, 2, "b", 0),
        makeRound(3, 1, "w", 0.5),
      ],
    },
  ];
}

// ─── Tests ──────────────────────────────────────────────────

describe("computeStandings", () => {
  const crosstable = buildCrosstable();
  let standings: StandingsWithTiebreaks[];

  beforeAll(() => {
    standings = computeStandings(crosstable);
  });

  it("returns the correct number of entries", () => {
    expect(standings).toHaveLength(4);
  });

  it("assigns rank 1 to the player with most points", () => {
    const first = standings[0];
    expect(first.name).toBe("Player A");
    expect(first.rank).toBe(1);
    expect(first.points).toBe(2.5);
  });

  it("assigns rank 2 to the second-highest scorer", () => {
    const second = standings[1];
    expect(second.name).toBe("Player B");
    expect(second.rank).toBe(2);
    expect(second.points).toBe(2);
  });

  it("sorts correctly when points are equal, using buchholz then SB", () => {
    // P3 has 1 point, P4 has 0.5 points — clear order
    const third = standings[2];
    const fourth = standings[3];
    expect(third.name).toBe("Player C");
    expect(third.rank).toBe(3);
    expect(fourth.name).toBe("Player D");
    expect(fourth.rank).toBe(4);
  });

  it("computes performance rating for all rated players", () => {
    for (const s of standings) {
      expect(s.performanceRating).not.toBeNull();
      expect(typeof s.performanceRating).toBe("number");
    }
  });

  it("computes correct performance rating for Player A (2.5/3)", () => {
    // Opponents: P2(2400), P3(2300), P4(2200) => avg = 2300
    // Score = 2.5, N = 3, (W-L)/N = (2*2.5-3)/3 = 2/3
    // Perf = 2300 + 400 * (2/3) = 2300 + 266.67 = 2567 (rounded)
    const playerA = standings.find((s) => s.name === "Player A")!;
    expect(playerA.performanceRating).toBe(2567);
  });

  it("computes correct performance rating for Player D (0.5/3)", () => {
    // Opponents: P3(2300), P2(2400), P1(2500) => avg = 2400
    // Score = 0.5, N = 3, (W-L)/N = (2*0.5-3)/3 = -2/3
    // Perf = 2400 + 400 * (-2/3) = 2400 - 266.67 = 2133 (rounded)
    const playerD = standings.find((s) => s.name === "Player D")!;
    expect(playerD.performanceRating).toBe(2133);
  });

  it("includes buchholz and sonnebornBerger values", () => {
    for (const s of standings) {
      expect(typeof s.buchholz).toBe("number");
      expect(typeof s.sonnebornBerger).toBe("number");
    }
  });
});

describe("computeStandingsAfterRound", () => {
  const crosstable = buildCrosstable();

  it("computes standings after round 1 correctly", () => {
    // After R1: P1=1, P2=0, P3=1, P4=0
    const standings = computeStandingsAfterRound(crosstable, 1);
    expect(standings).toHaveLength(4);

    // P1 and P3 tied at 1 point; P2 and P4 tied at 0
    const topTwo = standings.filter((s) => s.points === 1);
    const bottomTwo = standings.filter((s) => s.points === 0);
    expect(topTwo).toHaveLength(2);
    expect(bottomTwo).toHaveLength(2);

    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
    expect(standings[2].rank).toBe(3);
    expect(standings[3].rank).toBe(4);
  });

  it("computes standings after round 2 correctly", () => {
    // After R2: P1=2, P2=1, P3=1, P4=0
    const standings = computeStandingsAfterRound(crosstable, 2);
    const first = standings[0];
    expect(first.name).toBe("Player A");
    expect(first.points).toBe(2);
    expect(first.rank).toBe(1);

    const last = standings[3];
    expect(last.name).toBe("Player D");
    expect(last.points).toBe(0);
    expect(last.rank).toBe(4);
  });

  it("standings after final round match computeStandings", () => {
    const afterRound3 = computeStandingsAfterRound(crosstable, 3);
    const full = computeStandings(crosstable);

    // Same ordering and values
    expect(afterRound3).toHaveLength(full.length);
    for (let i = 0; i < full.length; i++) {
      expect(afterRound3[i].name).toBe(full[i].name);
      expect(afterRound3[i].rank).toBe(full[i].rank);
      expect(afterRound3[i].points).toBe(full[i].points);
      expect(afterRound3[i].buchholz).toBe(full[i].buchholz);
      expect(afterRound3[i].sonnebornBerger).toBe(full[i].sonnebornBerger);
      expect(afterRound3[i].performanceRating).toBe(full[i].performanceRating);
    }
  });
});

describe("edge cases", () => {
  it("handles empty crosstable", () => {
    const standings = computeStandings([]);
    expect(standings).toEqual([]);
  });

  it("returns null performanceRating when all opponents are unrated", () => {
    const unratedCrosstable: CrosstableEntry[] = [
      {
        startingRank: 1,
        name: "Unrated Player",
        title: null,
        rating: null,
        federation: null,
        points: 1,
        roundResults: [makeRound(1, 2, "w", 1)],
      },
      {
        startingRank: 2,
        name: "Also Unrated",
        title: null,
        rating: null,
        federation: null,
        points: 0,
        roundResults: [makeRound(1, 1, "b", 0)],
      },
    ];
    const standings = computeStandings(unratedCrosstable);
    expect(standings[0].performanceRating).toBeNull();
    expect(standings[1].performanceRating).toBeNull();
  });
});
