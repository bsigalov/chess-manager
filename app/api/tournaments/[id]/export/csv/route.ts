import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  exportStandingsCSV,
  exportPlayerListCSV,
} from "@/lib/export/csv-exporter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "standings";

    if (type !== "standings" && type !== "players") {
      return NextResponse.json(
        { error: 'Invalid type. Must be "standings" or "players".' },
        { status: 400 }
      );
    }

    const csv =
      type === "players"
        ? await exportPlayerListCSV(tournament.id)
        : await exportStandingsCSV(tournament.id);

    // Sanitize tournament name for use as filename
    const safeName = tournament.name
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 100);
    const filename = `${safeName}_${type}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    );
  }
}
