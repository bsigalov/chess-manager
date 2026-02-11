import { prisma } from "@/lib/db";

const BATCH_SIZE = 50;

/**
 * Format a result string to standard PGN result notation.
 */
function normalizePGNResult(result: string | null): string {
  if (!result) return "*";
  const trimmed = result.trim();
  if (trimmed === "1-0" || trimmed === "0-1" || trimmed === "1/2-1/2") {
    return trimmed;
  }
  if (trimmed === "½-½" || trimmed === "0.5-0.5") return "1/2-1/2";
  return "*";
}

/**
 * Format a date to PGN date format (YYYY.MM.DD).
 */
function formatPGNDate(date: Date | null): string {
  if (!date) return "????.??.??";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

/**
 * Escape a PGN header value by replacing backslash and quote characters.
 */
function escapePGNValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build PGN header block from a game record.
 */
function buildPGNHeaders(
  game: {
    round: number;
    result: string | null;
    ecoCode: string | null;
    whitePlayer: { name: string; rating: number | null };
    blackPlayer: { name: string; rating: number | null };
    pairing: { whiteElo: number | null; blackElo: number | null };
  },
  tournament: { name: string; venue: string | null; city: string | null },
  gameDate: Date | null
): string {
  const result = normalizePGNResult(game.result);
  const whiteElo = game.pairing.whiteElo ?? game.whitePlayer.rating;
  const blackElo = game.pairing.blackElo ?? game.blackPlayer.rating;

  const site = [tournament.venue, tournament.city]
    .filter(Boolean)
    .join(", ") || "?";

  const headers: [string, string][] = [
    ["Event", escapePGNValue(tournament.name)],
    ["Site", escapePGNValue(site)],
    ["Date", formatPGNDate(gameDate)],
    ["Round", String(game.round)],
    ["White", escapePGNValue(game.whitePlayer.name)],
    ["Black", escapePGNValue(game.blackPlayer.name)],
    ["Result", result],
  ];

  if (whiteElo != null) headers.push(["WhiteElo", String(whiteElo)]);
  if (blackElo != null) headers.push(["BlackElo", String(blackElo)]);
  if (game.ecoCode) headers.push(["ECO", game.ecoCode]);

  return headers.map(([tag, value]) => `[${tag} "${value}"]`).join("\n");
}

/**
 * Build PGN movetext from an array of move records.
 * Produces standard format: 1. e4 e5 2. Nf3 Nc6 ...
 * Lines are wrapped at ~80 characters for readability.
 */
function buildMovetext(
  moves: { moveNumber: number; color: string; san: string }[],
  result: string
): string {
  if (moves.length === 0) return result;

  const tokens: string[] = [];

  for (const move of moves) {
    if (move.color === "white") {
      tokens.push(`${move.moveNumber}.`);
    }
    tokens.push(move.san);
  }

  tokens.push(result);

  // Word-wrap at ~80 characters
  const lines: string[] = [];
  let currentLine = "";

  for (const token of tokens) {
    if (currentLine.length === 0) {
      currentLine = token;
    } else if (currentLine.length + 1 + token.length > 80) {
      lines.push(currentLine);
      currentLine = token;
    } else {
      currentLine += " " + token;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

/**
 * Export all games from a tournament in PGN format as an async generator.
 * Each yielded string is a complete PGN game block (headers + movetext),
 * separated by double newlines.
 *
 * Games are streamed in batches from the database to keep memory usage low.
 */
export async function* exportTournamentPGN(
  tournamentId: string
): AsyncGenerator<string> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      name: true,
      venue: true,
      city: true,
      startDate: true,
    },
  });

  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  let skip = 0;
  let isFirst = true;

  while (true) {
    const games = await prisma.game.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { board: "asc" }],
      skip,
      take: BATCH_SIZE,
      select: {
        id: true,
        round: true,
        result: true,
        ecoCode: true,
        pgnMovetext: true,
        startTime: true,
        whitePlayer: { select: { name: true, rating: true } },
        blackPlayer: { select: { name: true, rating: true } },
        pairing: { select: { whiteElo: true, blackElo: true, playedAt: true } },
      },
    });

    if (games.length === 0) break;

    for (const game of games) {
      const gameDate =
        game.startTime ?? game.pairing.playedAt ?? tournament.startDate;
      const result = normalizePGNResult(game.result);

      const headers = buildPGNHeaders(game, tournament, gameDate);

      let movetext: string;

      if (game.pgnMovetext) {
        // Use stored movetext if available, ensure it ends with result
        const trimmed = game.pgnMovetext.trim();
        const endsWithResult =
          trimmed.endsWith("1-0") ||
          trimmed.endsWith("0-1") ||
          trimmed.endsWith("1/2-1/2") ||
          trimmed.endsWith("*");
        movetext = endsWithResult ? trimmed : `${trimmed} ${result}`;
      } else {
        // Build movetext from individual moves in the database
        const moves = await prisma.move.findMany({
          where: { gameId: game.id },
          orderBy: { ply: "asc" },
          select: { moveNumber: true, color: true, san: true },
        });
        movetext = buildMovetext(moves, result);
      }

      const pgnBlock = `${headers}\n\n${movetext}`;
      const separator = isFirst ? "" : "\n\n";
      isFirst = false;

      yield separator + pgnBlock;
    }

    skip += BATCH_SIZE;

    if (games.length < BATCH_SIZE) break;
  }

  // If no games were found at all, also handle pairings that have results
  // (games without a Game record but with pairing data)
  if (isFirst) {
    const pairings = await prisma.pairing.findMany({
      where: { tournamentId, result: { not: null } },
      orderBy: [{ round: "asc" }, { board: "asc" }],
      select: {
        round: true,
        result: true,
        whiteElo: true,
        blackElo: true,
        playedAt: true,
        whitePlayer: { select: { name: true, rating: true } },
        blackPlayer: { select: { name: true, rating: true } },
      },
    });

    for (const pairing of pairings) {
      if (!pairing.whitePlayer || !pairing.blackPlayer) continue;

      const result = normalizePGNResult(pairing.result);
      const gameDate = pairing.playedAt ?? tournament.startDate;

      const game = {
        round: pairing.round,
        result: pairing.result,
        ecoCode: null,
        whitePlayer: pairing.whitePlayer,
        blackPlayer: pairing.blackPlayer,
        pairing: { whiteElo: pairing.whiteElo, blackElo: pairing.blackElo },
      };

      const headers = buildPGNHeaders(game, tournament, gameDate);
      const movetext = result;

      const pgnBlock = `${headers}\n\n${movetext}`;
      const separator = isFirst ? "" : "\n\n";
      isFirst = false;

      yield separator + pgnBlock;
    }
  }
}
