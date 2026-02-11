import { prisma } from "@/lib/db";

export interface ReportSection {
  heading: string;
  content: string;
}

export interface TournamentReport {
  title: string;
  sections: ReportSection[];
}

/**
 * Format a date as a locale-friendly string.
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generate a structured tournament report suitable for frontend rendering
 * as a PDF or printable view.
 *
 * Sections: Tournament Info, Final Standings, Round Results
 */
export async function exportTournamentReport(
  tournamentId: string
): Promise<TournamentReport> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: {
        include: { player: true },
        orderBy: [{ points: "desc" }, { currentRank: "asc" }],
      },
      pairings: {
        include: {
          whitePlayer: true,
          blackPlayer: true,
        },
        orderBy: [{ round: "asc" }, { board: "asc" }],
      },
    },
  });

  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  const sections: ReportSection[] = [];

  // -- Section 1: Tournament Info --
  const infoLines: string[] = [
    `Name: ${tournament.name}`,
  ];

  if (tournament.venue) infoLines.push(`Venue: ${tournament.venue}`);

  const location = [tournament.city, tournament.country]
    .filter(Boolean)
    .join(", ");
  if (location) infoLines.push(`Location: ${location}`);

  infoLines.push(`Dates: ${formatDate(tournament.startDate)} - ${formatDate(tournament.endDate)}`);
  infoLines.push(`Rounds: ${tournament.rounds}`);
  if (tournament.timeControl) infoLines.push(`Time Control: ${tournament.timeControl}`);
  if (tournament.tournamentType) infoLines.push(`Format: ${tournament.tournamentType}`);
  infoLines.push(`Status: ${tournament.status}`);
  infoLines.push(`Players: ${tournament.players.length}`);

  sections.push({
    heading: "Tournament Information",
    content: infoLines.join("\n"),
  });

  // -- Section 2: Final Standings --
  if (tournament.players.length > 0) {
    const header = padRow(["#", "Name", "Title", "Rating", "Pts", "Perf"]);
    const separator = "-".repeat(header.length);

    const standingsLines = [header, separator];

    tournament.players.forEach((tp, index) => {
      const rank = String(tp.currentRank ?? index + 1);
      const name = tp.player.name;
      const title = tp.player.title ?? "";
      const rating = String(tp.startingRating ?? tp.player.rating ?? "");
      const points = String(tp.points);
      const perf = tp.performance != null ? String(tp.performance) : "";

      standingsLines.push(padRow([rank, name, title, rating, points, perf]));
    });

    sections.push({
      heading: "Final Standings",
      content: standingsLines.join("\n"),
    });
  }

  // -- Section 3: Round Results --
  const roundsMap = new Map<number, typeof tournament.pairings>();
  for (const p of tournament.pairings) {
    const existing = roundsMap.get(p.round);
    if (existing) {
      existing.push(p);
    } else {
      roundsMap.set(p.round, [p]);
    }
  }

  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  for (const roundNum of sortedRounds) {
    const pairings = roundsMap.get(roundNum)!;
    const lines: string[] = [];

    const header = padRow(["Bd", "White", "Result", "Black"]);
    const separator = "-".repeat(header.length);
    lines.push(header, separator);

    for (const p of pairings) {
      const board = String(p.board);
      const white = p.whitePlayer?.name ?? "BYE";
      const black = p.blackPlayer?.name ?? "BYE";
      const result = p.result ?? "*";

      lines.push(padRow([board, white, result, black]));
    }

    sections.push({
      heading: `Round ${roundNum}`,
      content: lines.join("\n"),
    });
  }

  return {
    title: tournament.name,
    sections,
  };
}

/**
 * Pad columns to create a fixed-width text table row.
 */
function padRow(columns: string[]): string {
  const widths = [4, 30, 6, 6, 6, 6];
  return columns
    .map((col, i) => {
      const width = widths[i] ?? 10;
      return col.length > width ? col.slice(0, width) : col.padEnd(width);
    })
    .join("  ");
}
