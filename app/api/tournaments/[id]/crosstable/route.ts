import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBaseUrl, scrapeCrosstable } from "@/lib/scrapers/chess-results";
import type { CrosstableEntry } from "@/lib/types/tournament";

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

    // Check for cached crosstable in metadata
    const metadata = (tournament.metadata as Record<string, unknown>) || {};
    if (metadata.crosstable) {
      return NextResponse.json({
        crosstable: metadata.crosstable as CrosstableEntry[],
        cached: true,
      });
    }

    // Scrape fresh crosstable
    const baseUrl = parseBaseUrl(tournament.sourceUrl);
    const crosstable = await scrapeCrosstable(
      tournament.externalId,
      baseUrl
    );

    // Cache in tournament metadata (JSON.parse/stringify for Prisma JSON compatibility)
    await prisma.tournament.update({
      where: { id },
      data: {
        metadata: JSON.parse(JSON.stringify({ ...metadata, crosstable })),
      },
    });

    return NextResponse.json({ crosstable, cached: false });
  } catch (error) {
    console.error("Crosstable error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crosstable" },
      { status: 500 }
    );
  }
}
