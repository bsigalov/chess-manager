import { stringify } from "csv-stringify/sync";
import { prisma } from "@/lib/db";

/**
 * Export tournament standings as CSV.
 *
 * Columns: Rank, Name, Title, Rating, Federation, Points, GamesPlayed, Performance
 * Ordered by points descending, then rank ascending.
 */
export async function exportStandingsCSV(
  tournamentId: string
): Promise<string> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
    orderBy: [{ points: "desc" }, { currentRank: "asc" }],
  });

  const rows = players.map((tp, index) => ({
    Rank: tp.currentRank ?? index + 1,
    Name: tp.player.name,
    Title: tp.player.title ?? "",
    Rating: tp.startingRating ?? tp.player.rating ?? "",
    Federation: tp.player.country ?? "",
    Points: tp.points,
    GamesPlayed: tp.gamesPlayed,
    Performance: tp.performance ?? "",
  }));

  return stringify(rows, {
    header: true,
    columns: [
      "Rank",
      "Name",
      "Title",
      "Rating",
      "Federation",
      "Points",
      "GamesPlayed",
      "Performance",
    ],
  });
}

/**
 * Export tournament player list as CSV.
 *
 * Columns: StartingRank, Name, Title, Rating, FideId, Federation
 * Ordered by starting rank ascending.
 */
export async function exportPlayerListCSV(
  tournamentId: string
): Promise<string> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });

  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
    orderBy: { startingRank: "asc" },
  });

  const rows = players.map((tp, index) => ({
    StartingRank: tp.startingRank ?? index + 1,
    Name: tp.player.name,
    Title: tp.player.title ?? "",
    Rating: tp.startingRating ?? tp.player.rating ?? "",
    FideId: tp.player.fideId ?? "",
    Federation: tp.player.country ?? "",
  }));

  return stringify(rows, {
    header: true,
    columns: [
      "StartingRank",
      "Name",
      "Title",
      "Rating",
      "FideId",
      "Federation",
    ],
  });
}
