/**
 * player-analytics.test.ts
 * Unit tests for player analytics computation.
 */

import {
  computeVelocity,
  computeVelocitySeries,
  classifyMomentum,
  findPeakRating,
  monthsSincePeak,
  computeWinRateByBand,
  computeTournamentGains,
  computeAvgTournamentGain,
  computeMilestones,
  computeFullAnalytics,
} from "@/lib/analytics/player-analytics";
import type { RatingEntry, TournamentEntry, GameEntry } from "@/lib/scrapers/chess-org-il";
import type { DeepPlayerData } from "@/lib/cache/player-cache";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Rising player: +60 points over 12 months = +5 pts/mo
const risingHistory: RatingEntry[] = [
  { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
  { period: "01/04/2025", rating: 1820, recordedAt: new Date("2025-04-01") },
  { period: "01/07/2025", rating: 1840, recordedAt: new Date("2025-07-01") },
  { period: "01/10/2025", rating: 1860, recordedAt: new Date("2025-10-01") },
];

// Declining player: -40 points over 8 months = -5 pts/mo
const decliningHistory: RatingEntry[] = [
  { period: "01/01/2025", rating: 1900, recordedAt: new Date("2025-01-01") },
  { period: "01/05/2025", rating: 1880, recordedAt: new Date("2025-05-01") },
  { period: "01/09/2025", rating: 1860, recordedAt: new Date("2025-09-01") },
];

// Plateau player: ~0 change
const plateauHistory: RatingEntry[] = [
  { period: "01/01/2025", rating: 1750, recordedAt: new Date("2025-01-01") },
  { period: "01/04/2025", rating: 1752, recordedAt: new Date("2025-04-01") },
  { period: "01/08/2025", rating: 1748, recordedAt: new Date("2025-08-01") },
  { period: "01/12/2025", rating: 1751, recordedAt: new Date("2025-12-01") },
];

// ─── computeVelocity ─────────────────────────────────────────────────────────

describe("computeVelocity", () => {
  it("calculates positive velocity for rising player", () => {
    const velocity = computeVelocity(risingHistory);
    expect(velocity).toBeGreaterThan(0);
    // 60 points over ~9 months = ~6.67 pts/mo
    expect(velocity).toBeCloseTo(6.67, 0);
  });

  it("calculates negative velocity for declining player", () => {
    const velocity = computeVelocity(decliningHistory);
    expect(velocity).toBeLessThan(0);
    // -40 points over 8 months = -5 pts/mo
    expect(velocity).toBeCloseTo(-5, 0);
  });

  it("returns near-zero velocity for plateau player", () => {
    const velocity = computeVelocity(plateauHistory);
    expect(Math.abs(velocity)).toBeLessThan(1);
  });

  it("returns 0 for empty history", () => {
    expect(computeVelocity([])).toBe(0);
  });

  it("returns 0 for single-entry history", () => {
    const single: RatingEntry[] = [
      { period: "01/01/2025", rating: 1800, recordedAt: new Date("2025-01-01") },
    ];
    expect(computeVelocity(single)).toBe(0);
  });
});

// ─── computeVelocitySeries ─────────────────────────────────────────────────────

describe("computeVelocitySeries", () => {
  it("returns array of monthly velocities", () => {
    const series = computeVelocitySeries(risingHistory);
    expect(series).toHaveLength(3); // 4 entries = 3 intervals
    expect(series.every((v) => typeof v === "number")).toBe(true);
  });

  it("returns empty array for insufficient history", () => {
    expect(computeVelocitySeries([])).toHaveLength(0);
    expect(computeVelocitySeries([risingHistory[0]])).toHaveLength(0);
  });

  it("shows progression for rising player", () => {
    const series = computeVelocitySeries(risingHistory);
    // Each interval is ~3 months with ~20 pts gain = ~6.67 pts/mo
    expect(series[0]).toBeGreaterThan(0);
    expect(series[1]).toBeGreaterThan(0);
    expect(series[2]).toBeGreaterThan(0);
  });
});

// ─── classifyMomentum ─────────────────────────────────────────────────────────

describe("classifyMomentum", () => {
  it("classifies rising player as 'rising'", () => {
    expect(classifyMomentum(risingHistory)).toBe("rising");
  });

  it("classifies declining player as 'declining'", () => {
    expect(classifyMomentum(decliningHistory)).toBe("declining");
  });

  it("classifies plateau player as 'plateau'", () => {
    expect(classifyMomentum(plateauHistory)).toBe("plateau");
  });

  it("returns 'plateau' for empty history", () => {
    expect(classifyMomentum([])).toBe("plateau");
  });
});

// ─── findPeakRating ─────────────────────────────────────────────────────────────

describe("findPeakRating", () => {
  it("finds peak rating for rising player (most recent)", () => {
    const peak = findPeakRating(risingHistory);
    expect(peak.rating).toBe(1860);
    expect(peak.date.getTime()).toBe(new Date("2025-10-01").getTime());
  });

  it("finds peak rating for declining player (earliest)", () => {
    const peak = findPeakRating(decliningHistory);
    expect(peak.rating).toBe(1900);
    expect(peak.date.getTime()).toBe(new Date("2025-01-01").getTime());
  });

  it("returns default for empty history", () => {
    const peak = findPeakRating([]);
    expect(peak.rating).toBe(0);
  });
});

// ─── monthsSincePeak ─────────────────────────────────────────────────────────

describe("monthsSincePeak", () => {
  it("returns months since peak was achieved", () => {
    const months = monthsSincePeak(decliningHistory);
    // Peak was Jan 2025, now is ~Feb 2026 = ~13 months
    expect(months).toBeGreaterThan(10);
  });
});

// ─── computeWinRateByBand ─────────────────────────────────────────────────────

describe("computeWinRateByBand", () => {
  const games: GameEntry[] = [
    // vs weaker (-150)
    { date: new Date(), tournamentName: "T1", opponentName: "A", opponentRating: 1650, color: "white", result: "win" },
    { date: new Date(), tournamentName: "T1", opponentName: "B", opponentRating: 1680, color: "black", result: "win" },
    // vs similar
    { date: new Date(), tournamentName: "T1", opponentName: "C", opponentRating: 1780, color: "white", result: "draw" },
    { date: new Date(), tournamentName: "T1", opponentName: "D", opponentRating: 1820, color: "black", result: "loss" },
    // vs stronger (+150)
    { date: new Date(), tournamentName: "T1", opponentName: "E", opponentRating: 1950, color: "white", result: "loss" },
    { date: new Date(), tournamentName: "T1", opponentName: "F", opponentRating: 1920, color: "black", result: "draw" },
  ];

  it("calculates win rates by rating band", () => {
    const bands = computeWinRateByBand(games, 1800);
    expect(bands.length).toBeGreaterThan(0);
  });

  it("has correct wins for weaker opponents", () => {
    const bands = computeWinRateByBand(games, 1800);
    const weakerBand = bands.find((b) => b.band.includes("Weaker"));
    expect(weakerBand).toBeDefined();
    if (weakerBand) {
      expect(weakerBand.games).toBe(2);
      expect(weakerBand.wins).toBe(2);
      expect(weakerBand.rate).toBe(1);
    }
  });

  it("returns empty array for no games", () => {
    expect(computeWinRateByBand([], 1800)).toHaveLength(0);
  });
});

// ─── computeTournamentGains ─────────────────────────────────────────────────────

describe("computeTournamentGains", () => {
  const tournaments: TournamentEntry[] = [
    { date: new Date("2025-01-15"), tournamentName: "Winter Open", games: 7, points: 5, result: "5/7", ratingChange: 15 },
    { date: new Date("2025-02-20"), tournamentName: "February Rapid", games: 9, points: 6, result: "6/9", ratingChange: -5 },
    { date: new Date("2025-03-10"), tournamentName: "March Blitz", games: 5, points: 3, result: "3/5" }, // no rating change
  ];

  it("extracts tournament gains with rating changes", () => {
    const gains = computeTournamentGains(tournaments);
    expect(gains).toHaveLength(2); // Only entries with ratingChange
    expect(gains[0].name).toBe("Winter Open");
    expect(gains[0].gain).toBe(15);
    expect(gains[1].name).toBe("February Rapid");
    expect(gains[1].gain).toBe(-5);
  });

  it("sorts by date", () => {
    const gains = computeTournamentGains(tournaments);
    expect(gains[0].date.getTime()).toBeLessThan(gains[1].date.getTime());
  });

  it("returns empty array for no tournaments", () => {
    expect(computeTournamentGains([])).toHaveLength(0);
  });
});

// ─── computeAvgTournamentGain ─────────────────────────────────────────────────

describe("computeAvgTournamentGain", () => {
  const tournaments: TournamentEntry[] = [
    { date: new Date("2025-01-15"), tournamentName: "T1", games: 7, points: 5, result: "5/7", ratingChange: 20 },
    { date: new Date("2025-02-20"), tournamentName: "T2", games: 9, points: 6, result: "6/9", ratingChange: 10 },
    { date: new Date("2025-03-10"), tournamentName: "T3", games: 5, points: 3, result: "3/5", ratingChange: -15 },
  ];

  it("calculates average gain correctly", () => {
    const avg = computeAvgTournamentGain(tournaments);
    expect(avg).toBeCloseTo((20 + 10 - 15) / 3, 2);
  });

  it("returns null for empty tournaments", () => {
    expect(computeAvgTournamentGain([])).toBeNull();
  });

  it("returns null for tournaments without rating changes", () => {
    const noChanges: TournamentEntry[] = [
      { date: new Date(), tournamentName: "T1", games: 5, points: 3, result: "3/5" },
    ];
    expect(computeAvgTournamentGain(noChanges)).toBeNull();
  });
});

// ─── computeMilestones ─────────────────────────────────────────────────────────

describe("computeMilestones", () => {
  it("estimates months to future milestones for positive velocity", () => {
    const milestones = computeMilestones(1750, 10); // +10 pts/mo
    expect(milestones.length).toBeGreaterThan(0);

    // Should include 1800 (~5 months), 2000 (~25 months)
    const to1800 = milestones.find((m) => m.target === 1800);
    expect(to1800).toBeDefined();
    expect(to1800!.estimatedMonths).toBe(5); // 50 pts / 10 pts/mo

    const to2000 = milestones.find((m) => m.target === 2000);
    expect(to2000).toBeDefined();
    expect(to2000!.estimatedMonths).toBe(25); // 250 pts / 10 pts/mo
  });

  it("returns null estimates for declining velocity", () => {
    const milestones = computeMilestones(1750, -5);
    expect(milestones.every((m) => m.estimatedMonths === null)).toBe(true);
  });

  it("excludes already-reached milestones", () => {
    const milestones = computeMilestones(2100, 10);
    expect(milestones.find((m) => m.target === 1800)).toBeUndefined();
    expect(milestones.find((m) => m.target === 2000)).toBeUndefined();
    expect(milestones.find((m) => m.target === 2200)).toBeDefined();
  });
});

// ─── computeFullAnalytics ─────────────────────────────────────────────────────

describe("computeFullAnalytics", () => {
  const fullData: DeepPlayerData = {
    profile: {
      israeliId: 12345,
      name: "Test Player",
      israeliRating: 1860,
      birthYear: 2000,
      club: "Test Club",
    },
    ratingHistory: risingHistory,
    tournaments: [
      { date: new Date("2025-01-15"), tournamentName: "T1", games: 7, points: 5, result: "5/7", ratingChange: 20 },
      { date: new Date("2025-04-20"), tournamentName: "T2", games: 9, points: 6, result: "6/9", ratingChange: 20 },
    ],
    games: [
      { date: new Date(), tournamentName: "T1", opponentName: "A", opponentRating: 1700, color: "white", result: "win" },
      { date: new Date(), tournamentName: "T1", opponentName: "B", opponentRating: 1900, color: "black", result: "draw" },
    ],
  };

  it("computes all analytics fields", () => {
    const analytics = computeFullAnalytics(fullData);

    // Rating trend
    expect(analytics.velocity).toBeGreaterThan(0);
    expect(analytics.velocitySeries.length).toBeGreaterThan(0);
    expect(analytics.momentum).toBe("rising");
    expect(analytics.peakRating).toBe(1860);
    expect(analytics.peakDate).toBeInstanceOf(Date);
    expect(analytics.monthsSincePeak).toBeGreaterThanOrEqual(0);

    // Milestones
    expect(analytics.milestones.length).toBeGreaterThan(0);

    // Efficiency
    expect(analytics.avgRatingGainPerTournament).toBeCloseTo(20, 0);
    expect(analytics.tournamentGains).not.toBeNull();
    expect(analytics.tournamentGains!.length).toBe(2);
    expect(analytics.winRateByBand).not.toBeNull();
    expect(analytics.winRateByBand!.length).toBeGreaterThan(0);
  });

  it("handles empty tournaments and games gracefully", () => {
    const sparseData: DeepPlayerData = {
      profile: {
        israeliId: 12345,
        name: "Sparse Player",
        israeliRating: 1600,
      },
      ratingHistory: risingHistory,
      tournaments: [],
      games: [],
    };

    const analytics = computeFullAnalytics(sparseData);

    expect(analytics.avgRatingGainPerTournament).toBeNull();
    expect(analytics.tournamentGains).toBeNull();
    expect(analytics.winRateByBand).toBeNull();
  });
});
