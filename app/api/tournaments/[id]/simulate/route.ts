import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBaseUrl, scrapeCrosstable } from "@/lib/scrapers/chess-results";
import type { CrosstableEntry, HypotheticalResult } from "@/lib/types/tournament";
import { applyHypotheticalResults } from "@/lib/analytics/what-if";
import { runSimulation } from "@/lib/analytics/monte-carlo";

export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const iterations = Math.min(body.iterations || 50000, 100000);
    const hypotheticals: HypotheticalResult[] = body.hypotheticals || [];

    // Get crosstable
    const metadata = (tournament.metadata as Record<string, unknown>) || {};
    let crosstable: CrosstableEntry[];

    if (metadata.crosstable) {
      crosstable = metadata.crosstable as CrosstableEntry[];
    } else {
      const baseUrl = parseBaseUrl(tournament.sourceUrl);
      crosstable = await scrapeCrosstable(tournament.externalId, baseUrl);
    }

    if (crosstable.length === 0) {
      return NextResponse.json(
        { error: "No crosstable data available" },
        { status: 404 }
      );
    }

    // Apply hypothetical results if any
    const effectiveCrosstable =
      hypotheticals.length > 0
        ? applyHypotheticalResults(crosstable, hypotheticals)
        : crosstable;

    const result = runSimulation(
      effectiveCrosstable,
      tournament.rounds,
      iterations
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: "Failed to run simulation" },
      { status: 500 }
    );
  }
}
