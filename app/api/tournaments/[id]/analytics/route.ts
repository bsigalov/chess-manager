import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBaseUrl, scrapeCrosstable } from "@/lib/scrapers/chess-results";
import type { CrosstableEntry } from "@/lib/types/tournament";
import { computeStandings, computeStandingsAfterRound } from "@/lib/analytics/standings";
import { computePlayerStats } from "@/lib/analytics/player-stats";
import { runSimulation } from "@/lib/analytics/monte-carlo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Get crosstable (cached or fresh)
    const metadata = (tournament.metadata as Record<string, unknown>) || {};
    let crosstable: CrosstableEntry[];

    if (metadata.crosstable) {
      crosstable = metadata.crosstable as CrosstableEntry[];
    } else {
      const baseUrl = parseBaseUrl(tournament.sourceUrl);
      crosstable = await scrapeCrosstable(tournament.externalId, baseUrl);

      // Cache it (JSON roundtrip for Prisma JSON compatibility)
      await prisma.tournament.update({
        where: { id },
        data: { metadata: JSON.parse(JSON.stringify({ ...metadata, crosstable })) },
      });
    }

    if (crosstable.length === 0) {
      return NextResponse.json({ error: "No crosstable data available" }, { status: 404 });
    }

    // Compute analytics
    const standings = computeStandings(crosstable);
    const playerStats = crosstable.map((entry) =>
      computePlayerStats(entry.startingRank, crosstable)
    );

    // Rank progression: standings after each round
    const totalRounds = Math.max(
      ...crosstable.flatMap((e) => e.roundResults.map((r) => r.round))
    );
    const rankProgression: Record<number, { rank: number; points: number }[]> = {};
    for (let round = 1; round <= totalRounds; round++) {
      const roundStandings = computeStandingsAfterRound(crosstable, round);
      for (const s of roundStandings) {
        if (!rankProgression[s.startingRank]) {
          rankProgression[s.startingRank] = [];
        }
        rankProgression[s.startingRank].push({
          rank: s.rank,
          points: s.points,
        });
      }
    }

    // Simulation (only if tournament is ongoing)
    let simulation = null;
    if (tournament.status !== "completed") {
      simulation = runSimulation(crosstable, tournament.rounds, 10000);
    }

    return NextResponse.json({
      standings,
      playerStats,
      rankProgression,
      simulation,
      totalRounds,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
