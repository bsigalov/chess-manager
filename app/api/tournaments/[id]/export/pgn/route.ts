import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportTournamentPGN } from "@/lib/export/pgn-exporter";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Sanitize tournament name for use as filename
    const safeName = tournament.name
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 100);
    const filename = `${safeName}.pgn`;

    // Collect PGN output from the async generator
    const chunks: string[] = [];
    for await (const chunk of exportTournamentPGN(tournament.id)) {
      chunks.push(chunk);
    }
    const pgn = chunks.join("");

    return new Response(pgn || "No games found for this tournament.\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PGN export error:", error);
    return NextResponse.json(
      { error: "Failed to export PGN" },
      { status: 500 }
    );
  }
}
