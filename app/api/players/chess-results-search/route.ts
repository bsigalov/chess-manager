import { NextRequest, NextResponse } from "next/server";
import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lastName, firstName, fideId } = body as {
      lastName?: string;
      firstName?: string;
      fideId?: string;
    };

    if (!lastName && !firstName && !fideId) {
      return NextResponse.json(
        { error: "At least one search parameter is required" },
        { status: 400 }
      );
    }

    const params: { lastName?: string; firstName?: string; fideId?: string } =
      {};
    if (lastName) params.lastName = lastName;
    if (firstName) params.firstName = firstName;
    if (fideId) params.fideId = fideId;

    const players = await searchChessResultsPlayers(params);
    return NextResponse.json({ players });
  } catch (err) {
    if (err instanceof SyntaxError || (err as { name?: string }).name === "SyntaxError") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Could not reach chess-results.com", details: message },
      { status: 502 }
    );
  }
}
