import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportTournamentReport } from "@/lib/export/pdf-exporter";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    const report = await exportTournamentReport(tournament.id);

    return NextResponse.json(report);
  } catch (error) {
    console.error("PDF report export error:", error);
    return NextResponse.json(
      { error: "Failed to generate tournament report" },
      { status: 500 }
    );
  }
}
