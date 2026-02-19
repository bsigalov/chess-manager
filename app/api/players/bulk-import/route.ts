import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createImportJob,
  processImportJob,
} from "@/lib/import/import-service";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/players/bulk-import
 *
 * Accepts: { tournamentUrls: string[] }
 * Returns: { queued: number, skipped: number, jobIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentUrls } = body;

    if (
      !Array.isArray(tournamentUrls) ||
      tournamentUrls.length === 0
    ) {
      return NextResponse.json(
        { error: "tournamentUrls must be a non-empty array" },
        { status: 400 }
      );
    }

    // Optional auth — pass userId if authenticated
    const user = await getCurrentUser();
    const userId = user?.id;

    // Find already-imported tournaments by sourceUrl
    const existing = await prisma.tournament.findMany({
      where: { sourceUrl: { in: tournamentUrls } },
      select: { sourceUrl: true },
    });

    const existingUrls = new Set(existing.map((t) => t.sourceUrl));

    const newUrls = tournamentUrls.filter((url) => !existingUrls.has(url));
    const skipped = tournamentUrls.length - newUrls.length;

    // Create jobs and fire-and-forget processing
    const jobIds: string[] = [];
    for (const url of newUrls) {
      const jobId = await createImportJob(
        { sourceType: "chess-results", url },
        userId
      );
      jobIds.push(jobId);
      // Fire-and-forget — do not await
      processImportJob(jobId).catch((err) => {
        console.error(`bulk-import: processImportJob(${jobId}) failed:`, err);
      });
    }

    return NextResponse.json({
      queued: newUrls.length,
      skipped,
      jobIds,
    });
  } catch (error) {
    console.error("bulk-import error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk import request" },
      { status: 500 }
    );
  }
}
